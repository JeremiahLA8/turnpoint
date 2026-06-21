-- Keep booking data fresh continuously: pull from Hostaway every 15 minutes.
--
-- The `hostaway-webhook` function already handles real-time reservation events,
-- but webhooks can be missed (downtime, transient 5xx). This scheduled pull is
-- the safety net so the board never drifts from the PMS for long. It calls the
-- existing `hostaway-sync` function server-to-server with the service-role key
-- (the function recognises that as the trusted cron caller and skips the
-- per-user admin/manager check). Same vault secret as the Phase 4/7 crons.

do $$
begin
  perform cron.schedule(
    'hostaway-sync-15m',
    '*/15 * * * *',
    $cron$
      select
        net.http_post(
          url := 'https://your-project-ref.supabase.co/functions/v1/hostaway-sync',
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
