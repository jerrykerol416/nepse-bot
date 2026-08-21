/*
# Fix bot scheduler cron job

The cron job was failing because app.settings.supabase_url and
app.settings.service_role_key were never set as database-level
custom GUC parameters. The pg_cron extension runs in a separate
session that doesn't have access to these settings.

Fix: Hardcode the Supabase URL in the cron command and use the
anon key for the Authorization header (bot-scheduler has verify_jwt=false).
*/

-- Unschedule the broken job
SELECT cron.unschedule('nepse-bot-scheduler');

-- Reschedule with hardcoded URL and key
SELECT cron.schedule(
  'nepse-bot-scheduler',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jlazpkgsjouirindbylp.supabase.co/functions/v1/bot-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYXpwa2dzam91aXJpbmRieWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjI4MjUsImV4cCI6MjEwMjc5ODgyNX0.E-pMfO1FtWih6mM9TDJT-p1YshdcMbCn8RvjUK6KQZg'
    ),
    body := jsonb_build_object('source', 'pg_cron', 'timestamp', now()::text)
  );
  $$
);
