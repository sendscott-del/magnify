-- Magnify 024 — break the RLS recursion in the dashboard tables (2026-09-13).
--
-- The dashboard's three tables referenced each other's RLS policies in a
-- circle: magnify_items_select subqueried magnify_workstream_members, whose
-- policy subqueried magnify_workstreams, whose policy subqueried
-- magnify_workstream_members again. Postgres detects the loop and raises
-- 42P17 "infinite recursion detected in policy" on EVERY read of
-- magnify_items and magnify_workstreams by an authenticated user.
--
-- Consequence: no real user had been able to read a dashboard item or create a
-- workstream since 019 shipped on 08-31. The demo account (fixtures) and
-- service-role SQL (bypasses RLS) both worked, which is why it went unnoticed
-- for two weeks. Verified fixed by impersonating real users:
--   set local role authenticated; set local request.jwt.claims = '{"sub":"<uid>"}';
-- Every future policy on these tables must reach a sibling table through one
-- of the SECURITY DEFINER helpers below, never a direct subquery.

CREATE OR REPLACE FUNCTION magnify_is_ws_member(p_workstream_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM magnify_workstream_members
    WHERE workstream_id = p_workstream_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION magnify_ws_in_my_stake(p_workstream_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM magnify_workstreams
    WHERE id = p_workstream_id AND stake_id IN (SELECT current_user_stake())
  );
$$;

REVOKE ALL ON FUNCTION magnify_is_ws_member(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION magnify_ws_in_my_stake(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_is_ws_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_ws_in_my_stake(uuid) TO authenticated;

DROP POLICY IF EXISTS "magnify_items_select" ON magnify_items;
CREATE POLICY "magnify_items_select" ON magnify_items FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (
    magnify_is_stake_admin()
    OR (
      review_state = 'approved'
      AND (owner_user_id = auth.uid() OR magnify_is_ws_member(workstream_id))
    )
  )
);

DROP POLICY IF EXISTS "magnify_workstreams_select" ON magnify_workstreams;
CREATE POLICY "magnify_workstreams_select" ON magnify_workstreams FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (magnify_is_stake_admin() OR magnify_is_ws_member(id))
);

DROP POLICY IF EXISTS "magnify_ws_members_select" ON magnify_workstream_members;
CREATE POLICY "magnify_ws_members_select" ON magnify_workstream_members FOR SELECT USING (
  magnify_is_approved() AND magnify_ws_in_my_stake(workstream_id)
);

DROP POLICY IF EXISTS "magnify_ws_members_write" ON magnify_workstream_members;
CREATE POLICY "magnify_ws_members_write" ON magnify_workstream_members FOR ALL USING (
  magnify_is_stake_admin() AND magnify_ws_in_my_stake(workstream_id)
) WITH CHECK (
  magnify_is_stake_admin() AND magnify_ws_in_my_stake(workstream_id)
);
