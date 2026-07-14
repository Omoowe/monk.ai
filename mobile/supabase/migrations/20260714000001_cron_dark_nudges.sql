-- Schedule send-dark-nudges at 14:00 UTC daily
-- Fills the midday gap between morning (10:00) and evening (21:00) nudges
-- Only fires for users who went dark 2–5 days ago and were previously active

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'monk-dark-nudge',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-dark-nudges',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret',  current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
