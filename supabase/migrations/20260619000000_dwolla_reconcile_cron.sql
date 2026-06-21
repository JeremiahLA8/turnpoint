-- Crew payouts — schedule the ACH reconciliation safety net.
--
-- Every 6 hours, re-fetch authoritative transfer status from Dwolla for any
-- payout that isn't settled-and-old, catching missed webhooks and late ACH
-- returns. Uses the same service_role_key vault secret as the Phase 4/7 crons.

do $$
begin
  perform cron.schedule(
    'dwolla-reconcile-6h',
    '0 */6 * * *',
    $cron$
      select
        net.http_post(
          url := 'https://your-project-ref.supabase.co/functions/v1/dwolla-reconcile',
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
  );
end;
$$;
