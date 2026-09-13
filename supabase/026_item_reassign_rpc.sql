-- Reassigning an item is a SECURITY DEFINER operation because of how Postgres
-- evaluates RLS on UPDATE: the NEW row must also satisfy the SELECT policy for
-- the caller. When a high councilor hands his item to another counselor the
-- new row is no longer visible to him, so a plain UPDATE is refused with
-- "new row violates row-level security policy" even though the UPDATE
-- policy's WITH CHECK passes. Verified 2026-09-13 by swapping the SELECT
-- policy for `true` and watching the same UPDATE succeed.
--
-- The rules are the same ones the policies express: the presidency and clerks
-- may reassign anything in the stake to anyone; a high councilor may hand an
-- approved item he owns to another active high councilor. Nobody can reassign
-- a pending item except the presidency, and nothing here changes review_state.

CREATE OR REPLACE FUNCTION magnify_item_reassign(
  p_id uuid,
  p_owner_user_id uuid,
  p_owner_label text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_demo_user() THEN RAISE EXCEPTION 'Demo accounts cannot reassign items'; END IF;
  IF NOT magnify_is_approved() THEN RAISE EXCEPTION 'Not an approved Magnify user'; END IF;

  IF magnify_is_stake_admin() THEN
    UPDATE magnify_items
    SET owner_user_id = p_owner_user_id,
        owner_label   = NULLIF(btrim(COALESCE(p_owner_label, '')), '')
    WHERE id = p_id AND stake_id IN (SELECT current_user_stake());
  ELSE
    IF p_owner_user_id IS NULL OR NOT magnify_is_hc_user(p_owner_user_id) THEN
      RAISE EXCEPTION 'A high councilor can only hand an item to another high councilor';
    END IF;
    UPDATE magnify_items
    SET owner_user_id = p_owner_user_id,
        owner_label   = NULL
    WHERE id = p_id
      AND owner_user_id = auth.uid()
      AND review_state = 'approved'
      AND stake_id IN (SELECT current_user_stake());
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found, or you cannot reassign it'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION magnify_item_reassign(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_item_reassign(uuid, uuid, text) TO authenticated;
