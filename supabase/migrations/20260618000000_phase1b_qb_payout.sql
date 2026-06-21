-- Crew payouts — Phase 1b: book each payout as an expense in QuickBooks.
--
-- When a manager taps "Mark paid" (Phase 1, cleaner_payouts), the new
-- `qb-book-payout` edge function also posts a Purchase (cash/check expense) to
-- Ascend's existing QuickBooks company, isolated by a dedicated Class
-- ("Cleaning Ops") + expense account ("Cleaning - Crew") so it never tangles
-- with the rest of the property-management books. See the 2026-06-18 decision
-- in the second brain's decisions/log.md.
--
-- Two pieces of state:
--   1. qb_connection — a single-row OAuth token store for cleanos's own QB
--      connection (same Intuit app as the read side, an independent refresh
--      token so it never clobbers the second-brain scripts' token). The edge
--      function is the sole writer: it rotates the refresh token on every
--      refresh and persists the new one here.
--   2. sync columns on cleaner_payouts — the resulting QB Purchase id (so a
--      payout is booked at most once — idempotent retries) plus a last-error
--      string for the manual "Book to QB" retry in the Pay hub.

-- 1. OAuth token store. RLS on with NO policies → only the service_role key
--    (used by edge functions) can read/write it; no client ever sees the token.
create table public.qb_connection (
  id text primary key default 'default',
  refresh_token text not null,
  realm_id text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint qb_connection_singleton check (id = 'default')
);

alter table public.qb_connection enable row level security;
-- (intentionally no policies — service_role bypasses RLS; authenticated/anon get nothing)

-- 2. Per-payout QB sync state.
alter table public.cleaner_payouts
  add column qb_purchase_id text,
  add column qb_synced_at timestamptz,
  add column qb_sync_error text;

-- Fast lookup of not-yet-booked payouts for the retry queue.
create index cleaner_payouts_qb_unsynced_idx
  on public.cleaner_payouts (paid_at)
  where qb_purchase_id is null;
