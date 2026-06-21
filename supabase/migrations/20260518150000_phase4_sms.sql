-- Phase 4: SMS notifications (Twilio)
--
-- Adds:
--   1. profiles.phone TEXT — cleaner + manager phone numbers (E.164 or raw)
--   2. pg_net extension — for cron -> edge-function HTTP calls
--   3. Two cron schedules at 14:00 and 15:00 UTC daily — covers 7am PT in
--      both PDT (UTC-7) and PST (UTC-8). The edge function self-guards
--      against firing twice by checking the actual PT hour.
--
-- Manual setup AFTER pushing this migration (one-time):
--   a) Set Twilio secrets on the project:
--        supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=...
--   b) Store the project's service_role key in Supabase Vault so pg_cron can
--      authenticate to the edge function. Run this once in the SQL editor:
--        select vault.create_secret('<service_role_key>', 'service_role_key');
--      (The value lives in Project Settings -> API.)
--   c) Confirm cron schedules are active:
--        select * from cron.job;
--
-- Without (a), send-sms silently no-ops (returns ok+skipped). Without (b),
-- the cron POST returns 401 and the unassigned-jobs alert is skipped.

-- ============================================================================
-- (1) profiles.phone
-- ============================================================================

alter table public.profiles
  add column if not exists phone text;

-- ============================================================================
-- (2) Extensions
-- ============================================================================

create extension if not exists pg_net with schema extensions;
-- pg_cron is preinstalled on Supabase; create-if-not-exists is a no-op there.
create extension if not exists pg_cron;

-- ============================================================================
-- (3) Cron schedules — 7am PT trigger for unassigned-job alert
-- ============================================================================
--
-- Project URL is hardcoded here intentionally: it's not a secret, and pg_cron
-- runs in a separate background worker that cannot read Supabase function
-- secrets. The service_role key is pulled from Vault at runtime.

do $$
declare
  job_id bigint;
begin
  -- 14:00 UTC = 7am PDT (Mar–Nov)
  select cron.schedule(
    'notify-unassigned-7am-pdt',
    '0 14 * * *',
    $cron$
      select
        net.http_post(
          url := 'https://your-project-ref.supabase.co/functions/v1/notify-unassigned-jobs',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(
              (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
              ''
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
    $cron$
  ) into job_id;

  -- 15:00 UTC = 7am PST (Nov–Mar)
  select cron.schedule(
    'notify-unassigned-7am-pst',
    '0 15 * * *',
    $cron$
      select
        net.http_post(
          url := 'https://your-project-ref.supabase.co/functions/v1/notify-unassigned-jobs',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(
              (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
              ''
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
    $cron$
  ) into job_id;
end;
$$;
