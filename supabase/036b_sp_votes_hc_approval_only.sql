-- Tighten 036's third policy: the presidency's votes, not just the board.
--
-- 036 hid `stake_presidency_approvals` rows only while the calling was ON the
-- presidency board. Testing it as a real high councilor showed that still left
-- 230 of 257 vote rows readable — every vote on a calling that had since moved
-- on:
--
--   complete ......... 161
--   sustain ........... 31
--   issue_calling ..... 23
--   set_apart ......... 15
--
-- No screen shows him any of those. `showSPApprovals` in CallingDetailScreen
-- renders that section for for_approval, stake_approved, pending_interview and
-- hc_approval, and of those a non-admin can only reach hc_approval. So the
-- honest rule is the narrow one: a non-admin sees the presidency's votes at
-- hc_approval and nowhere else. That is the override note — the high council
-- needs to know whether the president has approved — and it is the whole of
-- what they need.
--
-- Verified as a plain high councilor in a rolled-back transaction, against a
-- synthetic hc_approval calling because the stake happens to have none right
-- now: SP-stage callings 0, SP-stage log rows 0, total vote rows visible 1
-- (the hc_approval one), his own board still 22.

CREATE OR REPLACE FUNCTION public.magnify_calling_at_hc_approval(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM callings WHERE id = cid AND stage = 'hc_approval');
$$;

COMMENT ON FUNCTION public.magnify_calling_at_hc_approval(uuid) IS
  'True while a calling sits at hc_approval — the only stage where a non-admin is shown the presidency votes (the override note). Used by 036.';

DROP POLICY IF EXISTS "sp_board_approvals_admin_only" ON stake_presidency_approvals;
CREATE POLICY "sp_board_approvals_admin_only" ON stake_presidency_approvals
  AS RESTRICTIVE FOR SELECT USING (
    magnify_is_stake_admin()
    OR magnify_calling_at_hc_approval(calling_id)
  );
