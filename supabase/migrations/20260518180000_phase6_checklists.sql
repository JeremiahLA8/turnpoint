-- Phase 6: Real persistence for checklists.
--
-- Replaces the localStorage-backed src/lib/checklists.ts with three new
-- tables plus a per-property assignment column.
--
--   checklist_templates       — reusable lists (e.g. "Standard 2BR clean")
--   checklist_items           — section + label, belongs to a template
--   properties.checklist_template_id — which template applies per property
--   job_checklist_completions — per-job toggle state for each item
--
-- RLS:
--   Templates + items: admin/manager manage; technician read (so cleaners
--   can see their assigned items). Reading a template doesn't expose
--   which property uses it — that's joined separately via properties RLS.
--
--   job_checklist_completions: admin/manager read all; technician
--   read+write only for jobs assigned to them, and only while the job
--   isn't completed (so completions are locked-in at completion time).

-- ============================================================================
-- (1) checklist_templates
-- ============================================================================

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

alter table public.checklist_templates enable row level security;

-- admin + manager: full CRUD
create policy "checklist_templates_select_admin_manager"
  on public.checklist_templates for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_templates_insert_admin_manager"
  on public.checklist_templates for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_templates_update_admin_manager"
  on public.checklist_templates for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_templates_delete_admin_manager"
  on public.checklist_templates for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read templates that are attached to a property they have a
-- job at (the join is done at query time; here we just open SELECT to all
-- techs and rely on the items policy + the property → template link)
create policy "checklist_templates_select_technician"
  on public.checklist_templates for select
  to authenticated
  using (public.has_role(auth.uid(), 'technician'));

-- ============================================================================
-- (2) checklist_items
-- ============================================================================

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  section text not null,
  label text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index checklist_items_template_id_idx on public.checklist_items(template_id);

alter table public.checklist_items enable row level security;

create policy "checklist_items_select_admin_manager"
  on public.checklist_items for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_items_insert_admin_manager"
  on public.checklist_items for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_items_update_admin_manager"
  on public.checklist_items for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_items_delete_admin_manager"
  on public.checklist_items for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "checklist_items_select_technician"
  on public.checklist_items for select
  to authenticated
  using (public.has_role(auth.uid(), 'technician'));

-- ============================================================================
-- (3) properties.checklist_template_id
-- ============================================================================

alter table public.properties
  add column if not exists checklist_template_id uuid
    references public.checklist_templates(id) on delete set null;

create index properties_checklist_template_id_idx
  on public.properties(checklist_template_id);

-- ============================================================================
-- (4) job_checklist_completions
-- ============================================================================

create table public.job_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (job_id, item_id)
);

create index job_checklist_completions_job_id_idx on public.job_checklist_completions(job_id);
create index job_checklist_completions_item_id_idx on public.job_checklist_completions(item_id);

alter table public.job_checklist_completions enable row level security;

-- admin + manager: read all
create policy "job_checklist_completions_select_admin_manager"
  on public.job_checklist_completions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read completions for jobs assigned to them
create policy "job_checklist_completions_select_technician"
  on public.job_checklist_completions for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_checklist_completions.job_id and cj.cleaner_id = auth.uid()
    )
  );

-- technician: insert their own completions for their own jobs while not completed
create policy "job_checklist_completions_insert_technician"
  on public.job_checklist_completions for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'technician')
    and completed_by = auth.uid()
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_checklist_completions.job_id
        and cj.cleaner_id = auth.uid()
        and cj.status != 'completed'
        and cj.status != 'cancelled'
    )
  );

-- technician: delete (uncheck) their own completions for their own jobs while not completed
create policy "job_checklist_completions_delete_technician"
  on public.job_checklist_completions for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and completed_by = auth.uid()
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_checklist_completions.job_id
        and cj.cleaner_id = auth.uid()
        and cj.status != 'completed'
        and cj.status != 'cancelled'
    )
  );

-- admin + manager: full write access (e.g. clearing completions during edits)
create policy "job_checklist_completions_insert_admin_manager"
  on public.job_checklist_completions for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "job_checklist_completions_delete_admin_manager"
  on public.job_checklist_completions for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));
