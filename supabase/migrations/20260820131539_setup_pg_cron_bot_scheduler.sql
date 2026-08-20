/*
# Set up pg_cron for automated bot scheduling

Enables pg_cron extension and creates a scheduled job that calls the bot-scheduler
edge function every 5 minutes. The edge function itself checks if it's market hours
(Sun-Thu, 11:00-15:00 NST) before placing trades.

The cron runs every 5 minutes 24/7 but the bot only takes action during market hours.
Outside market hours it just checks for stoploss/target exits on open positions.
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net for HTTP calls from within postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule bot-scheduler to run every 5 minutes
SELECT cron.unschedule('nepse-bot-scheduler') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nepse-bot-scheduler'
);

SELECT cron.schedule(
  'nepse-bot-scheduler',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/bot-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'timestamp', now()::text)
  );
  $$
);
