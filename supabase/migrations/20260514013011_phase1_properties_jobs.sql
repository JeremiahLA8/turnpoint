-- Phase 1: Properties + Cleaning Jobs
-- First real domain tables — replaces in-memory mock data for these entities.
-- Other entities (teammates, owners, payments, inventory, problems, checklists)
-- stay mock until later phases.

-- ============================================================================
-- updated_at trigger helper (shared across all tables with updated_at columns)
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- properties
-- ============================================================================

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  address text not null default '',
  beds integer not null default 0,
  baths integer not null default 0,
  sqft integer not null default 0,
  guests integer not null default 0,
  completion integer not null default 0 check (completion between 0 and 100),
  color text not null default 'bg-slate-300 text-slate-900',
  access_notes text,
  hostaway_listing_id text unique,
  default_cleaner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create index properties_default_cleaner_id_idx on public.properties(default_cleaner_id);

alter table public.properties enable row level security;

-- admin + manager: full read
create policy "properties_select_admin_manager"
  on public.properties for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- admin + manager: full write
create policy "properties_insert_admin_manager"
  on public.properties for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "properties_update_admin_manager"
  on public.properties for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "properties_delete_admin_manager"
  on public.properties for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- (technician read policy on properties is created below, after cleaning_jobs
-- exists — CREATE POLICY validates table references at definition time.)

-- ============================================================================
-- cleaning_jobs
-- ============================================================================

create type public.job_status as enum (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create table public.cleaning_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  cleaner_id uuid references auth.users(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  status public.job_status not null default 'scheduled',
  amount_cents integer,
  notes text,
  cleaner_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  hostaway_reservation_id text unique,
  guest_name text,
  check_in date,
  check_out date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cleaning_jobs_set_updated_at
  before update on public.cleaning_jobs
  for each row execute function public.set_updated_at();

create index cleaning_jobs_property_id_idx on public.cleaning_jobs(property_id);
create index cleaning_jobs_cleaner_id_idx on public.cleaning_jobs(cleaner_id);
create index cleaning_jobs_scheduled_start_idx on public.cleaning_jobs(scheduled_start);
create index cleaning_jobs_status_idx on public.cleaning_jobs(status);

alter table public.cleaning_jobs enable row level security;

-- admin + manager: full read
create policy "cleaning_jobs_select_admin_manager"
  on public.cleaning_jobs for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- admin + manager: full write
create policy "cleaning_jobs_insert_admin_manager"
  on public.cleaning_jobs for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "cleaning_jobs_update_admin_manager"
  on public.cleaning_jobs for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "cleaning_jobs_delete_admin_manager"
  on public.cleaning_jobs for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read jobs assigned to them
create policy "cleaning_jobs_select_technician"
  on public.cleaning_jobs for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and cleaner_id = auth.uid()
  );

-- technician: update jobs assigned to them
-- (column-level restriction — technicians can only touch status, cleaner_notes,
-- started_at, completed_at — is enforced at the application layer; RLS just
-- gates row access here.)
create policy "cleaning_jobs_update_technician"
  on public.cleaning_jobs for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and cleaner_id = auth.uid()
  )
  with check (
    public.has_role(auth.uid(), 'technician')
    and cleaner_id = auth.uid()
  );

-- ============================================================================
-- cross-table policy: technician read on properties (needs cleaning_jobs to exist)
-- ============================================================================

create policy "properties_select_technician"
  on public.properties for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1
      from public.cleaning_jobs cj
      where cj.property_id = properties.id
        and cj.cleaner_id = auth.uid()
    )
  );
