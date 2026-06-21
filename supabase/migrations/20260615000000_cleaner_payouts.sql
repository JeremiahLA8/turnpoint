-- Phase 1 of crew auto-pay: a payout ledger.
--
-- Records that a cleaner was actually paid for a clean — owed vs paid, with
-- history. Deliberately rail-agnostic: `method` is free text ('zelle',
-- 'quickbooks', 'check', ...) so the manual "tap Paid" of Phase 1 and a future
-- automated rail (QuickBooks Contractor Payments, Dwolla, Stripe Connect) write
-- the same row. The app derives "owed" (an approved clean with a rate + photos
-- and no payout row) and reads "paid" from this table.
--
-- One payout per clean (unique job_id). No Stripe anywhere — this is internal.

create table public.cleaner_payouts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cleaning_jobs(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  method text,
  note text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create index cleaner_payouts_cleaner_id_idx on public.cleaner_payouts(cleaner_id);
create index cleaner_payouts_job_id_idx on public.cleaner_payouts(job_id);

alter table public.cleaner_payouts enable row level security;

-- admin + manager: full control (they record payouts)
create policy "cleaner_payouts_select_admin_manager"
  on public.cleaner_payouts for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "cleaner_payouts_insert_admin_manager"
  on public.cleaner_payouts for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "cleaner_payouts_update_admin_manager"
  on public.cleaner_payouts for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create policy "cleaner_payouts_delete_admin_manager"
  on public.cleaner_payouts for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read their own payout history (so a cleaner can see they were paid)
create policy "cleaner_payouts_select_technician"
  on public.cleaner_payouts for select
  to authenticated
  using (public.has_role(auth.uid(), 'technician') and cleaner_id = auth.uid());
