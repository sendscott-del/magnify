-- Magnify 025 — Dashboard Phase 1 (2026-09-13).
--
-- Follows 024 (which broke the RLS recursion that had made magnify_items and
-- magnify_workstreams unreadable since 08-31). Every policy here reaches a
-- sibling table only through a SECURITY DEFINER helper — never a subquery on
-- an RLS-protected table. Keep it that way.
--
-- Scott's decisions this covers:
--   * Mine/Everyone and the review queue are PRESIDENCY only (clerks get Mine).
--   * Temple-recommend items are visible to the presidency only — not clerks.
--   * "Meeting to-dos" is gone. An item owned by a high councilor is an HC
--     assignment; one owned by the presidency is a stake presidency
--     assignment. A trigger keeps that true no matter who inserts.
--   * High council can delete their own items and reassign to another
--     high councilor.
--   * Standard work excludes the "Interviews" category — those are interviews.
--   * Quarterly interviews are WRITE-THROUGH to steward_interviews: Magnify
--     creates/edits/completes them there so Steward's grid and the exec-sec
--     agent keep working untouched.

-- ---------------------------------------------------------------- helpers --

CREATE OR REPLACE FUNCTION magnify_is_presidency()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND app = 'magnify' AND status = 'approved'
      AND role IN ('stake_president','first_counselor','second_counselor')
  );
$$;

-- Is this user id an active high councilor in the CALLER's stake?
CREATE OR REPLACE FUNCTION magnify_is_hc_user(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM high_council_members
    WHERE user_id = p_user AND active = true
      AND stake_id IN (SELECT current_user_stake())
  );
$$;

-- Is this user id a presidency member (by Magnify profile role)?
CREATE OR REPLACE FUNCTION magnify_is_presidency_user(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user AND app = 'magnify' AND status = 'approved'
      AND role IN ('stake_president','first_counselor','second_counselor')
  );
$$;

REVOKE ALL ON FUNCTION magnify_is_presidency() FROM public, anon;
REVOKE ALL ON FUNCTION magnify_is_hc_user(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION magnify_is_presidency_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_is_presidency() TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_is_hc_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_is_presidency_user(uuid) TO authenticated;

-- ---------------------------------------------------- items: kind by owner --
--
-- The tiles are keyed by kind, and Scott wants the kind to follow the owner:
-- a meeting to-do handed to a high councilor IS an HC assignment; one kept by
-- the presidency IS a presidency assignment. Enforcing it in a trigger means
-- the Zoom import, the "+" button and any future writer all agree.

CREATE OR REPLACE FUNCTION magnify_items_kind_by_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('action','assignment') AND NEW.owner_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM high_council_members
               WHERE user_id = NEW.owner_user_id AND active = true
                 AND stake_id = NEW.stake_id) THEN
      NEW.kind := 'assignment';
    ELSIF EXISTS (SELECT 1 FROM profiles
                  WHERE id = NEW.owner_user_id AND app = 'magnify' AND status = 'approved'
                    AND role IN ('stake_president','first_counselor','second_counselor')) THEN
      NEW.kind := 'action';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_magnify_items_kind_by_owner ON magnify_items;
CREATE TRIGGER trg_magnify_items_kind_by_owner
  BEFORE INSERT OR UPDATE OF kind, owner_user_id ON magnify_items
  FOR EACH ROW EXECUTE FUNCTION magnify_items_kind_by_owner();

-- Backfill the imported items: unassigned ones default to the stake president
-- (Scott's call), then the trigger re-kinds everything by owner.
UPDATE magnify_items
SET owner_user_id = (
      SELECT p.id FROM profiles p
      WHERE p.app = 'magnify' AND p.status = 'approved' AND p.role = 'stake_president'
        AND p.is_demo IS NOT TRUE
        AND EXISTS (SELECT 1 FROM user_stakes us WHERE us.user_id = p.id AND us.stake_id = magnify_items.stake_id)
      LIMIT 1),
    owner_label = NULL
WHERE kind IN ('action','assignment') AND owner_user_id IS NULL
  AND (owner_label IS NULL OR owner_label = '');

-- Touch every action/assignment row so the trigger runs once over history.
UPDATE magnify_items SET kind = kind WHERE kind IN ('action','assignment');

-- -------------------------------------------------------------- items RLS --

DROP POLICY IF EXISTS "magnify_items_select" ON magnify_items;
CREATE POLICY "magnify_items_select" ON magnify_items FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  -- Temple-recommend rows are the presidency's alone — not clerks.
  AND (kind <> 'recommend' OR magnify_is_presidency())
  AND (
    magnify_is_stake_admin()
    OR (
      review_state = 'approved'
      AND (owner_user_id = auth.uid() OR magnify_is_ws_member(workstream_id))
    )
  )
);

-- A non-admin may edit an approved item he owns, and may hand it to another
-- active high councilor. He still cannot move it out of 'approved', which is
-- what keeps approving a presidency-only act.
DROP POLICY IF EXISTS "magnify_items_update" ON magnify_items;
CREATE POLICY "magnify_items_update" ON magnify_items FOR UPDATE USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (magnify_is_stake_admin() OR (owner_user_id = auth.uid() AND review_state = 'approved'))
) WITH CHECK (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (
    magnify_is_stake_admin()
    OR (
      review_state = 'approved'
      AND (owner_user_id = auth.uid() OR magnify_is_hc_user(owner_user_id))
    )
  )
);

DROP POLICY IF EXISTS "magnify_items_delete" ON magnify_items;
CREATE POLICY "magnify_items_delete" ON magnify_items FOR DELETE USING (
  stake_id IN (SELECT current_user_stake())
  AND (
    magnify_is_stake_admin()
    OR (owner_user_id = auth.uid() AND review_state = 'approved')
  )
);

-- ------------------------------------------------ standard work: no interviews --
--
-- Scott's Steward has a category literally named "Interviews" holding one
-- quarterly behavior per leader he interviews. Those are interviews, and they
-- already have a tile; counting them as standard work double-reported them.

CREATE OR REPLACE FUNCTION magnify_dash_my_standard_work()
RETURNS TABLE (
  id uuid, name text, frequency text, category_name text,
  period_start date, value text, shared_task_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
         due.period_start, e.value, due.shared_task_id
  FROM due
  LEFT JOIN steward_entries e
    ON e.behavior_id = due.id
   AND e.user_id = auth.uid()
   AND e.entry_date = due.period_start
  WHERE due.iv <= 1
     OR (due.frequency = 'weekly' AND due.anchor_date IS NOT NULL
         AND MOD(((due.period_start - magnify_week_start(due.anchor_date)) / 7)::int, due.iv) = 0)
     OR (due.frequency = 'weekly' AND due.anchor_date IS NULL)
     OR due.frequency <> 'weekly'
  ORDER BY due.frequency, due.name;
$$;

-- ------------------------------------------- interviews: write-through --
--
-- Steward's RLS on steward_interviews is Steward-role based, so Magnify writes
-- go through SECURITY DEFINER with the presidency/clerk check done here.
-- Steward's own triggers (steward_sync_interview_to_entry) fire on these
-- writes exactly as they do for Steward's UI, so its grid stays in step.

CREATE OR REPLACE FUNCTION magnify_dash_interview_save(
  p_id uuid,
  p_name text,
  p_calling text,
  p_assigned_to uuid,
  p_scheduled_for date,
  p_year int,
  p_quarter int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_stake uuid;
BEGIN
  IF is_demo_user() THEN RAISE EXCEPTION 'Demo accounts cannot write interviews'; END IF;
  IF NOT magnify_is_stake_admin() THEN RAISE EXCEPTION 'Only the stake presidency or clerks can edit interviews'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Interview needs a name'; END IF;

  v_stake := current_user_stake_single();

  IF p_id IS NULL THEN
    INSERT INTO steward_interviews
      (interviewee_name, interviewee_calling, assigned_to_user_id, scheduled_for,
       year, quarter_num, stake_id, last_updated_by)
    VALUES
      (btrim(p_name), NULLIF(btrim(p_calling), ''), p_assigned_to, p_scheduled_for,
       p_year, p_quarter, v_stake, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE steward_interviews
    SET interviewee_name    = btrim(p_name),
        interviewee_calling = NULLIF(btrim(p_calling), ''),
        assigned_to_user_id = p_assigned_to,
        scheduled_for       = p_scheduled_for,
        last_updated_by     = auth.uid()
    WHERE id = p_id AND stake_id = v_stake
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Interview not found in your stake'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION magnify_dash_interview_complete(p_id uuid, p_done boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_demo_user() THEN RAISE EXCEPTION 'Demo accounts cannot write interviews'; END IF;
  IF NOT magnify_is_stake_admin() THEN RAISE EXCEPTION 'Only the stake presidency or clerks can complete interviews'; END IF;

  UPDATE steward_interviews
  SET completed_at = CASE WHEN p_done THEN current_date ELSE NULL END,
      last_updated_by = auth.uid()
  WHERE id = p_id AND stake_id IN (SELECT current_user_stake());

  IF NOT FOUND THEN RAISE EXCEPTION 'Interview not found in your stake'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION magnify_dash_interview_delete(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_demo_user() THEN RAISE EXCEPTION 'Demo accounts cannot write interviews'; END IF;
  IF NOT magnify_is_stake_admin() THEN RAISE EXCEPTION 'Only the stake presidency or clerks can delete interviews'; END IF;

  DELETE FROM steward_interviews
  WHERE id = p_id AND stake_id IN (SELECT current_user_stake());

  IF NOT FOUND THEN RAISE EXCEPTION 'Interview not found in your stake'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION magnify_dash_interview_save(uuid,text,text,uuid,date,int,int) FROM public, anon;
REVOKE ALL ON FUNCTION magnify_dash_interview_complete(uuid,boolean) FROM public, anon;
REVOKE ALL ON FUNCTION magnify_dash_interview_delete(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_dash_interview_save(uuid,text,text,uuid,date,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_dash_interview_complete(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_dash_interview_delete(uuid) TO authenticated;
