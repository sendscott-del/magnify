-- Dashboard, 2026-09-27: a Protecting Children and Youth kind, and notes on
-- the three things you can finish from the dashboard.
--
-- Scott asked for assignments, quarterly interviews and standard work to "be
-- configured exactly the same way": a done button you can press without
-- opening the card, and a place for notes. He believed two of the three had
-- notes already. Checking showed NONE had an editable notes field:
--
--   assignments  — the sheet edits title and owner; `detail` displays only
--   interviews   — no notes at all, though steward_interviews.notes exists
--   standard work — no notes
--
-- The done buttons are client-only. The notes need somewhere to live, and the
-- rule here (CLAUDE.md, "the dashboard owns only what had no home") is that
-- each goes where its data already lives rather than into a Magnify copy:
--
--   assignments   → magnify_items.detail          (Magnify's own; no SQL needed)
--   interviews    → steward_interviews.notes      (existing, unused column)
--   standard work → steward_cell_comments.comment (Steward's own per-cell notes)
--
-- The last two are Steward's tables, so a note written in Magnify shows in
-- Steward's grid and vice versa — the same write-through the interviews
-- already use (025).

-- ------------------------------------------------------------ 1. pcy kind
--
-- A leader overdue for Protecting Children and Youth training. Its own kind so
-- it gets its own tile and never lands in Assignments. The kind-by-owner
-- trigger (025) only rewrites 'action'/'assignment', so it leaves 'pcy' alone.
--
-- No RLS change: magnify_items_select already gives the right visibility —
-- the presidency and clerks see every row, a high councilor sees rows he owns
-- (his elders quorum, or seminary), and label-only rows owned by the stake
-- auxiliary presidents, who have no account, stay with the presidency.

ALTER TABLE magnify_items DROP CONSTRAINT IF EXISTS magnify_items_kind_check;
ALTER TABLE magnify_items ADD CONSTRAINT magnify_items_kind_check
  CHECK (kind IN ('action','assignment','interview','audit','recommend','directive','pcy'));

-- ----------------------------------------------- 2. standard work notes
--
-- The read gains a `note` column: this period's comment on the behavior.
-- RETURNS TABLE cannot change shape under CREATE OR REPLACE, hence the DROP.
-- Only the Magnify client calls it.

DROP FUNCTION IF EXISTS public.magnify_dash_my_standard_work();
CREATE FUNCTION public.magnify_dash_my_standard_work()
RETURNS TABLE(id uuid, name text, frequency text, category_name text,
              period_start date, value text, shared_task_id uuid, note text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH due AS (
    SELECT b.id, b.name, b.frequency, c.name AS category_name, b.shared_task_id,
           CASE b.frequency
             WHEN 'weekly'  THEN magnify_week_start(current_date)
             WHEN 'monthly' THEN date_trunc('month',   current_date)::date
             ELSE                date_trunc('quarter', current_date)::date
           END AS period_start,
           COALESCE(NULLIF(b.interval, 0), 1) AS iv,
           b.anchor_date
    FROM steward_behaviors b
    LEFT JOIN steward_categories c ON c.id = b.category_id
    WHERE b.user_id = auth.uid()
      AND b.is_archived = false
      AND NOT is_demo_user()
      AND COALESCE(c.name, '') NOT ILIKE 'interview%'
  )
  SELECT due.id, due.name, due.frequency, due.category_name,
         due.period_start, e.value, due.shared_task_id, cc.comment
  FROM due
  LEFT JOIN steward_entries e
    ON e.behavior_id = due.id
   AND e.user_id = auth.uid()
   AND e.entry_date = due.period_start
  LEFT JOIN steward_cell_comments cc
    ON cc.behavior_id = due.id
   AND cc.user_id = auth.uid()
   AND cc.entry_date = due.period_start
  WHERE due.iv <= 1
     OR (due.frequency = 'weekly' AND due.anchor_date IS NOT NULL
         AND MOD(((due.period_start - magnify_week_start(due.anchor_date)) / 7)::int, due.iv) = 0)
     OR (due.frequency = 'weekly' AND due.anchor_date IS NULL)
     OR due.frequency <> 'weekly'
  ORDER BY due.frequency, due.name;
$function$;

-- Write this period's note. Mirrors magnify_dash_set_standard_work: the caller
-- must own the behavior, and the demo guard is checked HERE because SECURITY
-- DEFINER bypasses the restrictive demo_block policies (CLAUDE.md gotcha — the
-- demo account once read real interviews through exactly this kind of RPC).
-- An empty note deletes the row rather than storing a blank one.
CREATE OR REPLACE FUNCTION public.magnify_dash_set_standard_work_note(p_behavior_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_freq   text;
  v_period date;
  v_note   text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF is_demo_user() THEN
    RAISE EXCEPTION 'Demo accounts cannot write standard work';
  END IF;

  SELECT frequency INTO v_freq
  FROM steward_behaviors
  WHERE id = p_behavior_id AND user_id = auth.uid();
  IF v_freq IS NULL THEN
    RAISE EXCEPTION 'Behavior not found for this user';
  END IF;

  v_period := CASE v_freq
    WHEN 'weekly'  THEN magnify_week_start(current_date)
    WHEN 'monthly' THEN date_trunc('month',   current_date)::date
    ELSE                date_trunc('quarter', current_date)::date
  END;

  IF v_note IS NULL THEN
    DELETE FROM steward_cell_comments
    WHERE user_id = auth.uid() AND behavior_id = p_behavior_id AND entry_date = v_period;
    RETURN;
  END IF;

  UPDATE steward_cell_comments
  SET comment = v_note, updated_at = now()
  WHERE user_id = auth.uid() AND behavior_id = p_behavior_id AND entry_date = v_period;
  IF NOT FOUND THEN
    INSERT INTO steward_cell_comments (user_id, behavior_id, entry_date, comment)
    VALUES (auth.uid(), p_behavior_id, v_period, v_note);
  END IF;
END;
$function$;

-- --------------------------------------------------- 3. interview notes
--
-- The read gains `notes`, but ONLY in the branches that already see the
-- interview in full: the president (all) and a counselor (his own). A high
-- councilor's branch is date-only by design (027) and it is HIS OWN interview
-- — the notes are about him. That branch returns NULL for notes, the same way
-- it already returns NULL for the calling and the assignee.

DROP FUNCTION IF EXISTS public.magnify_dash_interviews(integer, integer);
CREATE FUNCTION public.magnify_dash_interviews(p_year integer, p_quarter integer)
RETURNS TABLE(id uuid, interviewee_name text, interviewee_calling text,
              assigned_to_user_id uuid, assignee_name text,
              scheduled_for date, completed_at date, notes text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_name text;
BEGIN
  IF is_demo_user() THEN RETURN; END IF;
  SELECT p.role, p.full_name INTO v_role, v_name
  FROM profiles p WHERE p.id = auth.uid() AND p.app = 'magnify' AND p.status = 'approved';
  IF v_role IS NULL THEN RETURN; END IF;

  IF v_role = 'stake_president' THEN
    RETURN QUERY
      SELECT si.id, si.interviewee_name, si.interviewee_calling,
             si.assigned_to_user_id, sup.full_name, si.scheduled_for, si.completed_at,
             si.notes
      FROM steward_interviews si
      LEFT JOIN steward_user_profiles sup ON sup.id = si.assigned_to_user_id
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake());
  ELSIF v_role IN ('first_counselor','second_counselor') THEN
    RETURN QUERY
      SELECT si.id, si.interviewee_name, si.interviewee_calling,
             si.assigned_to_user_id, sup.full_name, si.scheduled_for, si.completed_at,
             si.notes
      FROM steward_interviews si
      LEFT JOIN steward_user_profiles sup ON sup.id = si.assigned_to_user_id
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake())
        AND si.assigned_to_user_id = auth.uid();
  ELSIF v_role = 'high_councilor' THEN
    RETURN QUERY
      SELECT si.id, si.interviewee_name, NULL::text,
             NULL::uuid, NULL::text, si.scheduled_for, si.completed_at,
             NULL::text
      FROM steward_interviews si
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake())
        AND si.interviewee_name = v_name;
  END IF;
  RETURN;
END;
$function$;

-- Write an interview's notes. Same gate as completing one (025): demo guard,
-- then stake admins only. Blank clears.
CREATE OR REPLACE FUNCTION public.magnify_dash_interview_set_notes(p_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF is_demo_user() THEN RAISE EXCEPTION 'Demo accounts cannot write interviews'; END IF;
  IF NOT magnify_is_stake_admin() THEN
    RAISE EXCEPTION 'Only the stake presidency or clerks can edit interview notes';
  END IF;

  UPDATE steward_interviews
  SET notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      last_updated_by = auth.uid()
  WHERE id = p_id AND stake_id IN (SELECT current_user_stake());

  IF NOT FOUND THEN RAISE EXCEPTION 'Interview not found in your stake'; END IF;
END;
$function$;

-- DROP FUNCTION removes grants; restore them so the client can call these.
GRANT EXECUTE ON FUNCTION public.magnify_dash_my_standard_work() TO authenticated;
GRANT EXECUTE ON FUNCTION public.magnify_dash_interviews(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magnify_dash_set_standard_work_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magnify_dash_interview_set_notes(uuid, text) TO authenticated;
