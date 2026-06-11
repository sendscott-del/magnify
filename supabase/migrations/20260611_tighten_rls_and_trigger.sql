-- Fix two security issues identified in the 2026-06-11 code review:
--
-- 1. RLS on callings/hc_approvals/stake_presidency_approvals/ward_sustainings
--    was scoped only to `status = 'approved'`, allowing any approved user to
--    perform any write regardless of role. Policies are now role-scoped to
--    match the client-side permission constants (ADMIN_GROUP / ALL_APPROVED).
--
-- 2. handle_new_user() copied the `role` field from client-supplied signup
--    metadata directly into profiles.role, allowing a malicious signUp call
--    with { role: 'stake_president' } to self-assign a privileged role.
--    Magnify signups now always start with 'stake_clerk'; admins assign the
--    real role when they approve the user.

-- ── callings ──────────────────────────────────────────────────────────────────

-- UPDATE: restrict to ADMIN_GROUP (was: any approved user)
DROP POLICY IF EXISTS "callings_update" ON callings;
CREATE POLICY "callings_update" ON callings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary'
        )
    )
  );

-- DELETE: expand to full ADMIN_GROUP (was: stake_president + stake_clerk only)
DROP POLICY IF EXISTS "Clerks can delete callings" ON callings;
DROP POLICY IF EXISTS "callings_delete" ON callings;
CREATE POLICY "callings_delete" ON callings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary'
        )
    )
  );

-- ── stake_presidency_approvals ────────────────────────────────────────────────

-- INSERT + UPDATE: restrict to ADMIN_GROUP (was: any approved user)
DROP POLICY IF EXISTS "sp_approvals_insert" ON stake_presidency_approvals;
DROP POLICY IF EXISTS "sp_approvals_update" ON stake_presidency_approvals;

CREATE POLICY "sp_approvals_insert" ON stake_presidency_approvals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary'
        )
    )
  );

CREATE POLICY "sp_approvals_update" ON stake_presidency_approvals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary'
        )
    )
  );

-- ── hc_approvals ─────────────────────────────────────────────────────────────

-- INSERT + UPDATE: ADMIN_GROUP + high_councilor (was: any approved user)
DROP POLICY IF EXISTS "hc_approvals_insert" ON hc_approvals;
DROP POLICY IF EXISTS "hc_approvals_update" ON hc_approvals;

CREATE POLICY "hc_approvals_insert" ON hc_approvals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary','high_councilor'
        )
    )
  );

CREATE POLICY "hc_approvals_update" ON hc_approvals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary','high_councilor'
        )
    )
  );

-- ── ward_sustainings ──────────────────────────────────────────────────────────

-- INSERT + UPDATE: ADMIN_GROUP + high_councilor (was: any approved user)
DROP POLICY IF EXISTS "ward_sustainings_insert" ON ward_sustainings;
DROP POLICY IF EXISTS "ward_sustainings_update" ON ward_sustainings;

CREATE POLICY "ward_sustainings_insert" ON ward_sustainings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary','high_councilor'
        )
    )
  );

CREATE POLICY "ward_sustainings_update" ON ward_sustainings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.app = 'magnify'
        AND profiles.status = 'approved'
        AND profiles.role IN (
          'stake_president','first_counselor','second_counselor',
          'stake_clerk','exec_secretary','high_councilor'
        )
    )
  );

-- ── handle_new_user trigger ───────────────────────────────────────────────────

-- Replace v_role with a hardcoded safe default for Magnify signups.
-- The client-supplied role in metadata is preserved in gather_access_requests
-- for informational purposes but never trusted for profiles.role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app  text := lower(coalesce(new.raw_user_meta_data->>'app', ''));
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'staff');
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
BEGIN
  -- Record access requests for Gathered-suite apps (informational only).
  IF v_app IN ('magnify','steward','glean','knit','tidings','conduct') THEN
    INSERT INTO gather_access_requests (user_id, email, full_name, app_name, requested_role)
    VALUES (new.id, coalesce(new.email,''), nullif(v_name,''), v_app,
            nullif(new.raw_user_meta_data->>'role',''))
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_app = 'magnify' THEN
    -- Always start with 'stake_clerk' regardless of what the client sent.
    -- Admins assign the correct role when they approve the user via Gather.
    INSERT INTO profiles (id, email, full_name, role, status, app)
    VALUES (new.id, coalesce(new.email, ''), v_name, 'stake_clerk', 'pending', 'magnify')
    ON CONFLICT (id) DO NOTHING;

  ELSIF v_app = 'squarecana' THEN
    INSERT INTO sq_users (id, email, full_name, status)
    VALUES (new.id, coalesce(new.email, ''), v_name, 'pending')
    ON CONFLICT (id) DO NOTHING;

  ELSIF v_app = 'sparkle' THEN
    INSERT INTO profiles (id, email, full_name, role, app)
    VALUES (new.id, coalesce(new.email, ''), v_name, v_role, 'sparkle')
    ON CONFLICT (id) DO NOTHING;
    IF v_role = 'owner' THEN
      INSERT INTO business_settings (owner_id, business_name)
      VALUES (new.id, 'Sparkle Pro')
      ON CONFLICT (owner_id) DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$;
