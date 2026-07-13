-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Morning nudge: 10:00 UTC daily (users who skipped morning check-in)
SELECT cron.schedule(
  'monk-morning-nudge',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-coach-nudges?type=morning',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'Authorization',   'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret',   current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Evening nudge: 21:00 UTC daily (users who skipped evening debrief)
SELECT cron.schedule(
  'monk-evening-nudge',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/send-coach-nudges?type=evening',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'Authorization',   'Bearer ' || current_setting('app.service_role_key', true),
      'x-cron-secret',   current_setting('app.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
