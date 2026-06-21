-- Phase 7 (part 1 of 2): Expand the job_status enum.
--
-- Postgres doesn't let you USE a newly added enum value in the same
-- transaction it was added in, so the data backfill + table changes that
-- depend on these new values live in the part-2 migration below.
--
-- Old enum values stay so existing rows remain valid until the part-2
-- backfill converts them; afterwards 'scheduled' is unused but kept in
-- the enum (Postgres can't cleanly drop enum values).
--
-- Final state machine:
--   pending → assigned → acknowledged → in_progress → completed → approved
--                                                          ↓
--                                                  (manager can un-approve)
--   cancelled  — terminal, reachable from anywhere (Hostaway-driven)

alter type public.job_status add value if not exists 'pending';
alter type public.job_status add value if not exists 'assigned';
alter type public.job_status add value if not exists 'acknowledged';
alter type public.job_status add value if not exists 'approved';
