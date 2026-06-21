-- Zero-config onboarding — store a tenant's Hostaway credentials so a new user
-- can paste their key in-app and have properties + turns sync, with no engineer
-- setting env secrets. Single row for now (single-tenant); structured to grow.
--
-- Holds an API key, so it's service_role-only (no policies) — only edge functions
-- read it; no client ever sees the key.

create table public.hostaway_config (
  id text primary key default 'default',
  account_id text not null,
  api_key text not null,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  constraint hostaway_config_singleton check (id = 'default')
);

alter table public.hostaway_config enable row level security;
-- (no policies — service_role only)
