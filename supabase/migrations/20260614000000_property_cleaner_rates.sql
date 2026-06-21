-- Crew pay rates: what each cleaner earns per property.
--
-- The first differentiator vs Turno is paying your own crew with no
-- marketplace cut. Pay is set per (property, cleaner): the same home can pay
-- different cleaners different amounts. A job's effective payout is resolved
-- read-time in the app as:
--
--   cleaning_jobs.amount_cents  (a manual per-job override)   -- wins if set
--   else property_cleaner_rates.amount_cents for (property, cleaner)
--   else nothing (unpriced — surfaced in the UI so it gets configured)
--
-- Read-time resolution means the 176 already-assigned live jobs show real
-- dollars the moment a rate is set, with no backfill, and a manual override
-- on a single job is never clobbered.

create table public.property_cleaner_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, cleaner_id)
);

create index property_cleaner_rates_property_id_idx on public.property_cleaner_rates(property_id);
create index property_cleaner_rates_cleaner_id_idx on public.property_cleaner_rates(cleaner_id);

create trigger property_cleaner_rates_set_updated_at
  before update on public.property_cleaner_rates
  for each row execute function public.set_updated_at();

alter table public.property_cleaner_rates enable row level security;

-- admin + manager: full CRUD (they set the rates)
create policy "pcr_select_admin_manager"
  on public.property_cleaner_rates for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "pcr_insert_admin_manager"
  on public.property_cleaner_rates for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "pcr_update_admin_manager"
  on public.property_cleaner_rates for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "pcr_delete_admin_manager"
  on public.property_cleaner_rates for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read only their own rates, so "My day" can show their pay.
-- They never see what other cleaners earn.
create policy "pcr_select_technician"
  on public.property_cleaner_rates for select
  to authenticated
  using (public.has_role(auth.uid(), 'technician') and cleaner_id = auth.uid());
