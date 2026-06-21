-- Phase C — AI photo quality check.
--
-- "Did the room actually get cleaned?" An AI vision pass over a job's after-photos
-- scores how clean/guest-ready the space looks and flags issues, giving managers
-- (and owners) a trust layer Turno doesn't have. One assessment per job, re-runnable.

create table public.job_photo_assessments (
  job_id uuid primary key references public.cleaning_jobs(id) on delete cascade,
  score integer check (score between 0 and 100),
  verdict text not null,                 -- 'pass' | 'review'
  summary text,
  issues jsonb not null default '[]'::jsonb,  -- [{ photo: int, issue: string }]
  assessed_at timestamptz not null default now(),
  assessed_by uuid references public.profiles(id) on delete set null
);

alter table public.job_photo_assessments enable row level security;

-- admin + manager: read + write (they run the check + review it)
create policy "jpa_all_admin_manager"
  on public.job_photo_assessments for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read the assessment for their own assigned job (feedback loop)
create policy "jpa_select_own"
  on public.job_photo_assessments for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_photo_assessments.job_id and cj.cleaner_id = auth.uid()
    )
  );
