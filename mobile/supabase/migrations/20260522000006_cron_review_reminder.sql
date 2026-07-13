-- Sunday 18:00 UTC review reminder
SELECT cron.schedule(
  'monk-review-reminder',
  '0 18 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-review-reminder',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'Authorization',   'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret',   current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
