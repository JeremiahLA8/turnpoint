-- Phase 5: Photo uploads (Supabase Storage)
--
-- Adds:
--   1. job_photos table   — metadata for every uploaded photo, with type
--      ('before' | 'after') and a foreign key back to cleaning_jobs.
--   2. job-photos bucket  — private (signed-URL access only) since interior
--      shots are sensitive.
--   3. RLS on both        — cleaners upload/read photos for jobs assigned
--      to them; admins/managers read every photo and can delete any.
--   4. Delete trigger     — when a job_photos row is deleted, the
--      corresponding storage object is removed too (so no orphans).
--
-- Storage path convention: "<job_id>/<type>/<uuid>.<ext>"
-- The first folder segment (job_id) is what RLS keys on, so policies can
-- check `cleaning_jobs.cleaner_id` for the matching job.

-- ============================================================================
-- (1) photo type enum + job_photos table
-- ============================================================================

create type public.photo_type as enum ('before', 'after');

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  type public.photo_type not null,
  storage_path text not null unique,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index job_photos_job_id_idx on public.job_photos(job_id);
create index job_photos_uploaded_by_idx on public.job_photos(uploaded_by);

alter table public.job_photos enable row level security;

-- admin + manager: read all photos
create policy "job_photos_select_admin_manager"
  on public.job_photos for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read photos on jobs assigned to them
create policy "job_photos_select_technician"
  on public.job_photos for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_photos.job_id and cj.cleaner_id = auth.uid()
    )
  );

-- admin + manager: insert/delete any photo row
create policy "job_photos_insert_admin_manager"
  on public.job_photos for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "job_photos_delete_admin_manager"
  on public.job_photos for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: insert photos for their own jobs (only while not cancelled)
create policy "job_photos_insert_technician"
  on public.job_photos for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id = job_photos.job_id
        and cj.cleaner_id = auth.uid()
        and cj.status != 'cancelled'
    )
    and uploaded_by = auth.uid()
  );

-- technician: delete only their own uploads, only before the job is completed
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
        and cj.status != 'completed'
    )
  );

-- ============================================================================
-- (2) storage bucket — private (signed URLs only)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

-- ============================================================================
-- (3) storage RLS — keyed on the job_id folder of the object path
-- ============================================================================
--
-- We allow:
--   - admin/manager: read + write + delete any object in the bucket
--   - technician: upload to / read from / delete from folders whose first
--     segment is a job_id assigned to them (and not cancelled / not completed,
--     respectively for write / delete).
--
-- storage.foldername(name) returns the path split into a text[]. The first
-- element [1] is the top-level folder, which is job_id under our convention.

create policy "storage_job_photos_select_admin_manager"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  );

create policy "storage_job_photos_insert_admin_manager"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  );

create policy "storage_job_photos_delete_admin_manager"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-photos'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  );

create policy "storage_job_photos_select_technician"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.has_role(auth.uid(), 'technician')
    and exists (
      select 1 from public.cleaning_jobs cj
      where cj.id::text = (storage.foldername(name))[1]
        and cj.cleaner_id = auth.uid()
    )
  );

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
        and cj.status != 'cancelled'
    )
  );

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
        and cj.status != 'completed'
    )
  );

-- ============================================================================
-- (4) trigger: when a job_photos row is deleted, drop the storage object too
-- ============================================================================

create or replace function public.on_job_photo_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
   where bucket_id = 'job-photos'
     and name = old.storage_path;
  return old;
end;
$$;

create trigger job_photos_after_delete
  after delete on public.job_photos
  for each row execute function public.on_job_photo_deleted();
