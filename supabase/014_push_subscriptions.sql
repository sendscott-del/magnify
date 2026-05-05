-- Web Push subscription registry + Postgres → Edge Function trigger.
-- Already applied to remote via Supabase MCP on 2026-05-05.
-- Pairs with: supabase/functions/magnify-send-action-pushes/index.ts

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS magnify_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  last_count INT NOT NULL DEFAULT 0,
  last_pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magnify_push_subscriptions_user
  ON magnify_push_subscriptions(user_id);

ALTER TABLE magnify_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push subs"   ON magnify_push_subscriptions;
DROP POLICY IF EXISTS "Users insert own push subs" ON magnify_push_subscriptions;
DROP POLICY IF EXISTS "Users update own push subs" ON magnify_push_subscriptions;
DROP POLICY IF EXISTS "Users delete own push subs" ON magnify_push_subscriptions;

CREATE POLICY "Users read own push subs"
  ON magnify_push_subscriptions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users insert own push subs"
  ON magnify_push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own push subs"
  ON magnify_push_subscriptions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own push subs"
  ON magnify_push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Vault-stored secrets used by the trigger (created if absent — values
-- are set out-of-band in the deployed environment, do not commit values
-- here).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'magnify_push_internal_secret') THEN
    PERFORM vault.create_secret(
      coalesce(current_setting('magnify.push_internal_secret', true), 'PLACEHOLDER_SET_VIA_DASHBOARD'),
      'magnify_push_internal_secret',
      'Shared secret used by the magnify-send-action-pushes Edge Function to authenticate trigger calls'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'magnify_push_function_url') THEN
    PERFORM vault.create_secret(
      'https://isogetmvnpimcmouakeg.supabase.co/functions/v1/magnify-send-action-pushes',
      'magnify_push_function_url',
      'URL of the magnify-send-action-pushes Edge Function'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION magnify_notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  fn_url TEXT;
  fn_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO fn_url
    FROM vault.decrypted_secrets WHERE name = 'magnify_push_function_url';
  SELECT decrypted_secret INTO fn_secret
    FROM vault.decrypted_secrets WHERE name = 'magnify_push_internal_secret';

  IF fn_url IS NULL OR fn_secret IS NULL THEN
    RAISE WARNING 'magnify_notify_push: missing vault secrets, skipping push fanout';
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || fn_secret
    ),
    body := jsonb_build_object('source', TG_TABLE_NAME, 'op', TG_OP)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS magnify_callings_push_trigger ON callings;
CREATE TRIGGER magnify_callings_push_trigger
  AFTER INSERT OR UPDATE OR DELETE ON callings
  FOR EACH STATEMENT EXECUTE FUNCTION magnify_notify_push();

DROP TRIGGER IF EXISTS magnify_hc_approvals_push_trigger ON hc_approvals;
CREATE TRIGGER magnify_hc_approvals_push_trigger
  AFTER INSERT OR UPDATE OR DELETE ON hc_approvals
  FOR EACH STATEMENT EXECUTE FUNCTION magnify_notify_push();
