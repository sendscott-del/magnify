-- The magnify_notify_push() function is a SECURITY DEFINER trigger handler
-- that fires Web Push notifications when actionable callings change. It
-- should only be invoked by row triggers, never as a public RPC call.
-- Revoking EXECUTE from anon/authenticated stops the supabase advisors
-- 0028/0029 warnings without affecting trigger firing (triggers ignore
-- the EXECUTE grant on the underlying function).
REVOKE EXECUTE ON FUNCTION public.magnify_notify_push() FROM anon, authenticated, PUBLIC;
