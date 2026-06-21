-- Phase 5 follow-up: make the photo-delete trigger fault-tolerant.
--
-- The previous trigger ran `delete from storage.objects` inline. On Supabase,
-- storage.objects has its own permission model that the trigger's session
-- may not have access to, so the delete raised "permission denied" and
-- rolled the whole DELETE back — which surfaced as a "Failed to remove
-- photo" toast in the cleaner UI.
--
-- Fix: catch any exception inside the trigger so the row-delete always
-- succeeds. The client is now responsible for deleting the storage object
-- first (using its own auth + the storage RLS policy that already permits
-- it). The trigger then acts purely as a best-effort safety net for cases
-- where the row is deleted indirectly — most notably the
-- `on delete cascade` from cleaning_jobs.

create or replace function public.on_job_photo_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    delete from storage.objects
     where bucket_id = 'job-photos'
       and name = old.storage_path;
  exception when others then
    -- Best effort only — never block the row delete.
    raise notice 'on_job_photo_deleted: could not delete storage object % (%): %',
      old.storage_path, sqlstate, sqlerrm;
  end;
  return old;
end;
$$;
