-- Damage / issue flag on a cleaning job.
--
-- Cleaners raise an issue ("cracked patio glass", "stain on master bedding")
-- from the job sheet while cleaning. Flagged turns surface on the per-property
-- owner report as the trust signal owners pay for.
--
-- No new RLS: cleaning_jobs already lets a technician update their own assigned
-- row (that's how cleaner_notes / status are written) and admin/manager update
-- any row, so these two columns inherit the right access.

alter table public.cleaning_jobs
  add column if not exists issue_flagged boolean not null default false,
  add column if not exists issue_note text;
