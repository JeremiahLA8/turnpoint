-- Add an explicit region/area field to properties.
--
-- Drives the Readiness board's group headers and the area filter. Nullable —
-- when unset, the app falls back to a city parsed from the address, so this is
-- a pure enhancement with no backfill required. Set per-property from the
-- board's home drill-down sheet. Existing RLS update policies (admin/manager)
-- already cover writes to this column.

alter table public.properties
  add column if not exists region text;

create index if not exists properties_region_idx on public.properties (region);
