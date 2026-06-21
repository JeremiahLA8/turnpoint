-- Crew payouts — Phase 2: actual ACH disbursement via Dwolla.
--
-- QuickBooks has no API to MOVE money (Bill Pay / Contractor Payments are
-- UI-only), so true in-app "Pay now" runs on Dwolla's ACH API. A payout becomes
-- a Dwolla Transfer from Ascend's verified funding source -> the cleaner's bank.
-- Phase 1b still books the expense to QuickBooks in parallel — Dwolla moves the
-- money, QB keeps the books.
--
-- No raw bank numbers are ever stored here: account/routing go straight to
-- Dwolla, and we keep only the returned resource ids + a last4 for display.

-- App/business-level Dwolla config (single row): Ascend's verified Dwolla
-- customer + the funding source money is sent FROM. service_role only.
create table public.dwolla_config (
  id text primary key default 'default',
  customer_id text,                            -- Ascend's Dwolla customer id (verified business)
  funding_source_id text,                      -- bank account payouts are sent from
  environment text not null default 'sandbox', -- 'sandbox' | 'production'
  updated_at timestamptz not null default now(),
  constraint dwolla_config_singleton check (id = 'default')
);
alter table public.dwolla_config enable row level security;
-- (no policies — only the service_role key, used by edge functions, can touch it)

-- Per-cleaner Dwolla identity: their receive-only customer + bank funding source.
-- We store ids + last4 only; Dwolla holds the actual bank credentials.
create table public.cleaner_dwolla (
  cleaner_id uuid primary key references public.profiles(id) on delete cascade,
  customer_id text not null,
  funding_source_id text,
  bank_last4 text,
  status text not null default 'unverified', -- funding source state for display
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cleaner_dwolla_set_updated_at
  before update on public.cleaner_dwolla
  for each row execute function public.set_updated_at();

alter table public.cleaner_dwolla enable row level security;

-- admin + manager: manage every cleaner's payout identity
create policy "cleaner_dwolla_all_admin_manager"
  on public.cleaner_dwolla for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- technician: read their own (so "My day" can show "direct deposit set up")
create policy "cleaner_dwolla_select_own"
  on public.cleaner_dwolla for select
  to authenticated
  using (public.has_role(auth.uid(), 'technician') and cleaner_id = auth.uid());

-- ACH transfer tracking on each payout.
alter table public.cleaner_payouts
  add column dwolla_transfer_id text,
  add column dwolla_status text,        -- pending | processed | failed | cancelled
  add column dwolla_synced_at timestamptz;
