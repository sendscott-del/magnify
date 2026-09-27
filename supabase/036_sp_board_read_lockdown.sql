-- The stake presidency board was UI-only. Enforce it in the database.
--
-- Found 2026-09-25, after Scott reported a high councilor seeing the SP board.
-- His role was wrong (a data fix), but checking it turned up the real problem:
-- `callings_select` grants SELECT on EVERY calling to EVERY approved Magnify
-- user in the stake. The only exclusions are demo users and stake_council.
-- The presidency board and the HC board are separated by which stages each
-- SCREEN queries, and by nothing else.
--
-- Measured as a real high councilor (no clerk or presidency role) in a
-- rolled-back transaction:
--
--   callings in SP-only stages ............ 11 rows
--   calling_log for those callings ........ 26 rows
--   stake_presidency_approvals (all) ..... 257 rows
--
-- He cannot reach them through the app's screens, but the anon key and a
-- browser console are enough. For a Church-lane app holding names against
-- callings not yet extended — and the presidency's own votes — that is the
-- exposure, not the menu.
--
-- SP-only stages are the ones the presidency board owns, matching SP_STAGES in
-- lib/slack.ts: ideas, for_approval, stake_approved, pending_interview. Once a
-- calling reaches hc_approval it is the high council's work and stays visible
-- to them, including its earlier history — the gate is the calling's CURRENT
-- stage, which is also how the two boards decide what to show.
--
-- SELECT only, deliberately. Writes are already correct and do not need
-- touching: `callings_update` confines a high councilor to issue_calling /
-- ordained / sustain / set_apart rows assigned to him by name, and
-- `callings_delete` is admin-only. Adding FOR ALL here would restrict writes
-- that are already impossible, and risk breaking paths this change has not
-- traced. Note the one interaction that IS wanted: on UPDATE Postgres also
-- checks the NEW row against the caller's SELECT policy, so a non-admin can no
-- longer move a calling INTO an SP stage either.
--
-- RESTRICTIVE, so it ANDs with `callings_select` rather than widening anything.
-- Same shape as `no_callings_for_stake_council` (029), which already works this
-- way.

-- Is this calling currently on the presidency board? SECURITY DEFINER so the
-- policies on calling_log and stake_presidency_approvals can ask about a row
-- the caller is not allowed to read — without that, the lookup would be
-- filtered by the very policy it is feeding.
CREATE OR REPLACE FUNCTION public.magnify_calling_on_sp_board(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM callings
    WHERE id = cid
      AND stage IN ('ideas','for_approval','stake_approved','pending_interview')
  );
$$;

COMMENT ON FUNCTION public.magnify_calling_on_sp_board(uuid) IS
  'True while a calling sits in a stake-presidency-board stage. Used by the 036 read lockdown.';

-- 1. The callings themselves.
DROP POLICY IF EXISTS "sp_board_callings_admin_only" ON callings;
CREATE POLICY "sp_board_callings_admin_only" ON callings
  AS RESTRICTIVE FOR SELECT USING (
    stage NOT IN ('ideas','for_approval','stake_approved','pending_interview')
    OR magnify_is_stake_admin()
  );

-- 2. Their history. calling_log carries the member name and the stage moves,
--    so leaving it open would hand back everything policy 1 just closed.
DROP POLICY IF EXISTS "sp_board_calling_log_admin_only" ON calling_log;
CREATE POLICY "sp_board_calling_log_admin_only" ON calling_log
  AS RESTRICTIVE FOR SELECT USING (
    NOT magnify_calling_on_sp_board(calling_id)
    OR magnify_is_stake_admin()
  );

-- 3. The presidency's votes. Kept visible once a calling reaches the HC board:
--    CallingDetailScreen renders this section at stage hc_approval and shows
--    the high council whether the president has approved, which the override
--    note depends on. Only rows for callings still ON the presidency board are
--    closed.
DROP POLICY IF EXISTS "sp_board_approvals_admin_only" ON stake_presidency_approvals;
CREATE POLICY "sp_board_approvals_admin_only" ON stake_presidency_approvals
  AS RESTRICTIVE FOR SELECT USING (
    NOT magnify_calling_on_sp_board(calling_id)
    OR magnify_is_stake_admin()
  );
