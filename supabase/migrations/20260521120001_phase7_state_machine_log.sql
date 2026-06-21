-- Phase 7 (part 2 of 2): State machine — backfill, defaults, audit log,
-- auto-bump trigger, and tighter RLS for the new statuses.
--
-- Depends on the part-1 migration (20260521120000_phase7_state_machine_enum.sql)
-- having already added 'pending', 'assigned', 'acknowledged', 'approved'.

-- ============================================================================
-- (1) approved_at timestamp
-- ============================================================================

alter table public.cleaning_jobs
  add column if not exists approved_at timestamptz;

-- ============================================================================
-- (2) Backfill: convert old 'scheduled' rows to pending / assigned
-- ============================================================================
--
-- 'scheduled' with no cleaner → 'pending' (job exists but nobody owns it)
-- 'scheduled' with a cleaner  → 'assigned' (cleaner has been picked, but
--                                           hasn't acknowledged yet)

update public.cleaning_jobs
   set status = 'assigned'
 where status = 'scheduled' and cleaner_id is not null;

update public.cleaning_jobs
   set status = 'pending'
 where status = 'scheduled' and cleaner_id is null;

-- ============================================================================
-- (3) New default
-- ============================================================================

alter table public.cleaning_jobs
  alter column status set default 'pending';

-- ============================================================================
-- (4) job_status_log — every status transition logged
-- ============================================================================

create table public.job_status_log (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  notes text
);

create index job_status_log_job_id_idx on public.job_status_log(job_id);
create index job_status_log_changed_at_idx on public.job_status_log(changed_at);

alter table public.job_status_log enable row level security;

-- admin + manager: read every transition
create policy "job_status_log_select_admin_manager"
  on public.job_status_log for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read transitions for jobs assigned to them
create policy "job_status_log_select_technician"
  on public.job_status_log for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_status_log.job_id and cj.cleaner_id = auth.uid()
    )
  );

-- No insert/update/delete policies: rows are written exclusively by the
-- trigger below (which runs as the table owner, bypassing RLS). The audit
-- log is intentionally append-only from the app's point of view.

-- ============================================================================
-- (5) Trigger: log every status transition
-- ============================================================================

create or replace function public.log_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_log (job_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.job_status_log (job_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

create trigger cleaning_jobs_log_status_change
  after insert or update of status on public.cleaning_jobs
  for each row execute function public.log_job_status_change();

-- Backfill an initial log row for every existing job, so the audit timeline
-- isn't empty on day 1. changed_by is null since we don't know who set the
-- original status. changed_at uses the job's created_at.
insert into public.job_status_log (job_id, from_status, to_status, changed_by, changed_at, notes)
select id, null, status, null, created_at, 'Backfilled from Phase 7 migration'
  from public.cleaning_jobs;

-- ============================================================================
-- (6) Trigger: auto-bump status when cleaner_id changes
-- ============================================================================
--
-- Keeps cleaner_id and status in sync so the Hostaway webhook (which only
-- touches cleaner_id + date) doesn't have to know about the state machine.
--
--   cleaner_id NULL → not-NULL : pending → assigned   (only if currently pending)
--   cleaner_id not-NULL → NULL : * → pending           (unless completed/approved/cancelled)
--
-- The trigger is intentionally conservative: it only overrides status when
-- the app hasn't explicitly set one, so manual mutations from the manager UI
-- stay authoritative.

create or replace function public.auto_bump_job_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Cleaner assigned
  if old.cleaner_id is null and new.cleaner_id is not null
     and new.status = old.status
     and new.status = 'pending' then
    new.status := 'assigned';
  end if;

  -- Cleaner unassigned (revert to pending unless the job is terminal)
  if old.cleaner_id is not null and new.cleaner_id is null
     and new.status = old.status
     and new.status not in ('completed', 'approved', 'cancelled') then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

create trigger cleaning_jobs_auto_bump_status
  before update of cleaner_id on public.cleaning_jobs
  for each row execute function public.auto_bump_job_status();

-- ============================================================================
-- (7) Tighten Phase 5 RLS: block photo writes once a job is approved
-- ============================================================================
--
-- Phase 5 already blocks deletes on 'completed' and inserts on 'cancelled'.
-- After Phase 7 a manager-approved job should be fully locked down for the
-- cleaner — they can't add or remove photos either.

drop policy if exists "job_photos_insert_technician" on public.job_photos;
create policy "job_photos_insert_technician"
  on public.job_photos for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_photos.job_id
        and cj.cleaner_id = auth.uid()
        and cj.status not in ('cancelled', 'approved')
    )
    and uploaded_by = auth.uid()
  );

drop policy if exists "job_photos_delete_technician" on public.job_photos;
create policy "job_photos_delete_technician"
  on public.job_photos for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_photos.job_id
        and cj.cleaner_id = auth.uid()
        and cj.status not in ('completed', 'approved')
    )
  );

drop policy if exists "storage_job_photos_insert_technician" on storage.objects;
create policy "storage_job_photos_insert_technician"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id::text = (storage.foldername(name))[1]
        and cj.cleaner_id = auth.uid()
        and cj.status not in ('cancelled', 'approved')
    )
  );

drop policy if exists "storage_job_photos_delete_technician" on storage.objects;
create policy "storage_job_photos_delete_technician"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id::text = (storage.foldername(name))[1]
        and cj.cleaner_id = auth.uid()
        and cj.status not in ('completed', 'approved')
    )
  );

-- ============================================================================
-- (8) Tighten Phase 6 RLS: block checklist toggles once approved
-- ============================================================================

drop policy if exists "job_checklist_completions_insert_technician" on public.job_checklist_completions;
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
        and cj.status not in ('completed', 'cancelled', 'approved')
    )
  );

drop policy if exists "job_checklist_completions_delete_technician" on public.job_checklist_completions;
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
        and cj.status not in ('completed', 'cancelled', 'approved')
    )
  );

-- ============================================================================
-- (9) Cron schedule: acknowledge-reminder edge function
-- ============================================================================
--
-- Fires every hour and texts assigned cleaners who haven't acknowledged a
-- job that starts within the next 24 hours. The edge function dedupes via
-- a window check (only sends once per (job, cleaner) pair) so re-runs are
-- safe even if the schedule overlaps.

do $$
begin
  perform cron.schedule(
    'notify-unacknowledged-hourly',
    '0 * * * *',
    $cron$
      select
        net.http_post(
          url := 'https://your-project-ref.supabase.co/functions/v1/notify-unacknowledged-jobs',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(
              (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
              ''
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
    $cron$
  );
end;
$$;
