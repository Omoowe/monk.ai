-- Daily goal deadline alerts: 9:00 UTC
SELECT cron.schedule(
  'monk-goal-alerts',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-goal-alerts',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'Authorization',   'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret',   current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
