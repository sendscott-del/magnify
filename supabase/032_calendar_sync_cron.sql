-- Magnify 032 — schedule the calendar sync (2026-09-19).
-- Every 30 minutes, pg_cron posts to magnify-sync-google-calendar with the
-- same internal secret the push trigger uses (Vault: magnify_push_internal_secret).
-- The function URL is derived from the push function URL in Vault. The
-- function itself does nothing until the MAGNIFY_GCAL_ICS_URL secret is set.
CREATE OR REPLACE FUNCTION magnify_calendar_sync_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  push_url text;
  fn_secret text;
BEGIN
  SELECT decrypted_secret INTO push_url FROM vault.decrypted_secrets WHERE name = 'magnify_push_function_url';
  SELECT decrypted_secret INTO fn_secret FROM vault.decrypted_secrets WHERE name = 'magnify_push_internal_secret';
  IF push_url IS NULL OR fn_secret IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := replace(push_url, 'magnify-send-action-pushes', 'magnify-sync-google-calendar'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_secret),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE ALL ON FUNCTION magnify_calendar_sync_tick() FROM public, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'magnify-calendar-sync';
SELECT cron.schedule('magnify-calendar-sync', '*/30 * * * *', $$SELECT magnify_calendar_sync_tick()$$);
