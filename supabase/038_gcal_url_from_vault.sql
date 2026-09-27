-- Let magnify-sync-google-calendar read the calendar address from Vault.
--
-- The function was written to read the project secret MAGNIFY_GCAL_ICS_URL,
-- but setting a project secret needs the Supabase CLI or dashboard, and it was
-- never set — so the 30-minute cron returned 500 on every call from 2026-09-19.
-- Scott supplied the address on 2026-09-27. It is stored in Vault as
-- `magnify_gcal_ics_url` (created by hand, NOT in this file — it is a private
-- link that exposes the whole calendar), the same place the push cron already
-- keeps `magnify_push_internal_secret`.
--
-- The function tries the project secret first and falls back to this RPC, so
-- moving the address to a project secret later needs no code change.
--
-- Callable by the service role only: the address is a credential, and nobody
-- signed in to the app has any reason to read it.

CREATE OR REPLACE FUNCTION public.magnify_gcal_ics_url()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'magnify_gcal_ics_url' LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.magnify_gcal_ics_url() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magnify_gcal_ics_url() TO service_role;
