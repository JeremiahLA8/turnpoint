-- Phase 3: Cleaner assignment
--
-- Goals:
-- 1) Let staff (admin / manager) read all profiles + user_roles so the
--    assignment UI can list technicians and so the cleaner name embeds on
--    cleaning_jobs queries.
-- 2) Re-target the cleaning_jobs.cleaner_id FK from auth.users(id) to
--    profiles(id) — every auth user has a matching profile row (created by
--    the on_auth_user_created trigger), and profiles.id is itself a
--    CASCADE-delete FK to auth.users(id), so this preserves cascade
--    behavior while allowing PostgREST to embed the cleaner profile via
--    the standard `cleaner:profiles(...)` select syntax.

-- ============================================================================
-- (1a) profiles: staff can read every row
-- ============================================================================

create policy "profiles_select_staff"
  on public.profiles for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
  );

-- ============================================================================
-- (1b) user_roles: managers can read every row
-- (admins already covered by the existing "Admins can view all roles" policy.)
-- ============================================================================

create policy "user_roles_select_managers"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'manager'));

-- ============================================================================
-- (2) cleaning_jobs.cleaner_id FK → profiles(id)
-- ============================================================================

alter table public.cleaning_jobs
  drop constraint cleaning_jobs_cleaner_id_fkey;

alter table public.cleaning_jobs
  add constraint cleaning_jobs_cleaner_id_fkey
  foreign key (cleaner_id)
  references public.profiles(id)
  on delete set null;
