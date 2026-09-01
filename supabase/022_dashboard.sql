-- Magnify 022 — Stake Presidency Dashboard (Phase 1).
--
-- Authored as "019" against a stale checkout and renumbered on rebase; it is
-- recorded in the database under the migration name `magnify_019_dashboard`
-- (plus `magnify_019b_...` / `magnify_019c_...`). The file number is what
-- matters going forward.
--
-- Adds the "Shape A" obligation spine (magnify_items) plus workstreams,
-- meetings and quarterly metrics. Everything else the dashboard shows is READ
-- from where it already lives: callings stay in `callings`, quarterly
-- interviews stay in `steward_interviews`, standard work stays in
-- `steward_behaviors`/`steward_entries`. The dashboard owns only what had no
-- home — duplicating the rest is what would make the app heavy and wrong.
--
-- Tenancy: every table carries NOT NULL stake_id and is same-stake via
-- current_user_stake(), matching the Stage-2 pattern applied 2026-07-09.
-- NOTE for service-role writers (the LCR sync agent): stake_id defaults from
-- current_user_stake_single(), which is NULL without an auth.uid() — a
-- service-role insert MUST pass stake_id explicitly.
--
-- Demo mode: demo users are blocked from these tables entirely (RESTRICTIVE
-- policy, same as `callings`). The dashboard's demo experience is client-side
-- fixtures, per lib/demoCallings.ts.

-- ---------------------------------------------------------------- helpers --

-- Approved Magnify user holding a presidency or clerk role. Used by every
-- policy below so the role list lives in exactly one place.
CREATE OR REPLACE FUNCTION magnify_is_stake_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND app = 'magnify'
      AND status = 'approved'
      AND role IN ('stake_president','first_counselor','second_counselor',
                   'stake_clerk','exec_secretary')
  );
$$;

CREATE OR REPLACE FUNCTION magnify_is_approved()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND app = 'magnify' AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION magnify_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Sunday-anchored week start. Steward's date-fns helpers use
-- { weekStartsOn: 0 }, so a weekly steward_entries.entry_date is the SUNDAY of
-- that week. Postgres date_trunc('week') is Monday-anchored and would be off by
-- one — do not substitute it.
CREATE OR REPLACE FUNCTION magnify_week_start(d date)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT d - EXTRACT(DOW FROM d)::int;
$$;

-- ------------------------------------------------------------ workstreams --

CREATE TABLE IF NOT EXISTS magnify_workstreams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id    uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text,
  target_date date,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','archived')),
  sort_order  int  NOT NULL DEFAULT 0,
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magnify_workstream_members (
  workstream_id uuid NOT NULL REFERENCES magnify_workstreams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workstream_id, user_id)
);

-- --------------------------------------------------------------- meetings --

CREATE TABLE IF NOT EXISTS magnify_meetings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id                uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  body                    text NOT NULL DEFAULT 'other'
                            CHECK (body IN ('SP','HC','SC','BC','SP_RS','other')),
  met_on                  date NOT NULL,
  zoom_meeting_uuid       text,
  agenda_url              text,
  transcript_processed_at timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ items --

CREATE TABLE IF NOT EXISTS magnify_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id      uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('action','assignment','interview','audit','recommend','directive')),
  title         text NOT NULL,
  detail        text,
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','blocked','done','dropped')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- For leaders without a Magnify account (a bishop, an HC member who hasn't
  -- signed up). Display falls back to this when owner_user_id is null.
  owner_label   text,
  due_on        date,
  ward_id       uuid REFERENCES wards(id) ON DELETE SET NULL,
  workstream_id uuid REFERENCES magnify_workstreams(id) ON DELETE SET NULL,
  meeting_id    uuid REFERENCES magnify_meetings(id) ON DELETE SET NULL,
  source        text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','meeting','lcr_sync','email')),
  source_ref    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Anything extracted from a meeting starts pending and is invisible to the
  -- dashboard until a human approves it in the review queue.
  review_state  text NOT NULL DEFAULT 'approved'
                  CHECK (review_state IN ('approved','pending_review')),
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_magnify_items_stake_status ON magnify_items(stake_id, status);
CREATE INDEX IF NOT EXISTS idx_magnify_items_owner        ON magnify_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_magnify_items_due          ON magnify_items(due_on);
CREATE INDEX IF NOT EXISTS idx_magnify_items_workstream   ON magnify_items(workstream_id);
CREATE INDEX IF NOT EXISTS idx_magnify_items_review       ON magnify_items(stake_id, review_state);
CREATE INDEX IF NOT EXISTS idx_magnify_ws_members_user    ON magnify_workstream_members(user_id);

DROP TRIGGER IF EXISTS trg_magnify_items_touch ON magnify_items;
CREATE TRIGGER trg_magnify_items_touch BEFORE UPDATE ON magnify_items
  FOR EACH ROW EXECUTE FUNCTION magnify_touch_updated_at();

DROP TRIGGER IF EXISTS trg_magnify_workstreams_touch ON magnify_workstreams;
CREATE TRIGGER trg_magnify_workstreams_touch BEFORE UPDATE ON magnify_workstreams
  FOR EACH ROW EXECUTE FUNCTION magnify_touch_updated_at();

-- ---------------------------------------------------------------- metrics --

CREATE TABLE IF NOT EXISTS magnify_metric_defs (
  metric_key text PRIMARY KEY,
  label      text NOT NULL,
  label_es   text,
  unit       text,
  direction  text NOT NULL DEFAULT 'up' CHECK (direction IN ('up','down')),
  sort_order int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS magnify_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id    uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  metric_key  text NOT NULL REFERENCES magnify_metric_defs(metric_key) ON DELETE CASCADE,
  period_start date NOT NULL,
  value       numeric NOT NULL,
  -- Target is per-stake, so it lives with the value, not the definition.
  target      numeric,
  source      text NOT NULL DEFAULT 'lcr_sync' CHECK (source IN ('manual','lcr_sync')),
  synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stake_id, metric_key, period_start)
);

CREATE INDEX IF NOT EXISTS idx_magnify_metrics_lookup ON magnify_metrics(stake_id, metric_key, period_start);

-- The six metrics the presidency reviews quarterly. Values are per-stake and
-- land in magnify_metrics; these rows are just display config so the UI never
-- hardcodes a metric name.
INSERT INTO magnify_metric_defs (metric_key, label, label_es, unit, direction, sort_order) VALUES
  ('endowed_current_recommend', 'Endowed with current recommend', 'Investidos con recomendación vigente', 'members',   'up',   1),
  ('convert_baptisms_12mo',     'Convert baptisms, rolling 12 mo', 'Bautismos de conversos, 12 meses',   'baptisms',  'up',   2),
  ('sacrament_attendance',      'Sacrament meeting attendance',    'Asistencia a la reunión sacramental','attending', 'up',   3),
  ('ministering_interviews',    'Ministering interviews completed','Entrevistas de ministración',        'completed', 'up',   4),
  ('members_with_callings',     'Members with callings',           'Miembros con llamamientos',          'members',   'up',   5),
  ('convert_retention',         'Convert retention',               'Retención de conversos',             '%',         'up',   6)
ON CONFLICT (metric_key) DO UPDATE
  SET label = EXCLUDED.label, label_es = EXCLUDED.label_es,
      unit = EXCLUDED.unit, direction = EXCLUDED.direction,
      sort_order = EXCLUDED.sort_order;

-- -------------------------------------------------------------------- RLS --

ALTER TABLE magnify_workstreams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_workstream_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_meetings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_metrics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_metric_defs        ENABLE ROW LEVEL SECURITY;

-- Items -----------------------------------------------------------------
-- Presidency and clerks see the whole stake's board. A high councilor sees
-- only what is his: items he owns, plus items inside a workstream he belongs
-- to. This is enforced here rather than client-side so "Everyone" scope can
-- never leak presidency to-dos to the high council.
DROP POLICY IF EXISTS "magnify_items_select" ON magnify_items;
CREATE POLICY "magnify_items_select" ON magnify_items FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (
    magnify_is_stake_admin()
    OR owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM magnify_workstream_members m
      WHERE m.workstream_id = magnify_items.workstream_id AND m.user_id = auth.uid()
    )
  )
);

-- Anyone approved may add an item; a non-admin may only add one owned by
-- himself, so a high councilor can capture his own to-do without being able to
-- assign work to the presidency.
DROP POLICY IF EXISTS "magnify_items_insert" ON magnify_items;
CREATE POLICY "magnify_items_insert" ON magnify_items FOR INSERT WITH CHECK (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (magnify_is_stake_admin() OR owner_user_id = auth.uid())
);

DROP POLICY IF EXISTS "magnify_items_update" ON magnify_items;
CREATE POLICY "magnify_items_update" ON magnify_items FOR UPDATE USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (magnify_is_stake_admin() OR owner_user_id = auth.uid())
) WITH CHECK (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (magnify_is_stake_admin() OR owner_user_id = auth.uid())
);

DROP POLICY IF EXISTS "magnify_items_delete" ON magnify_items;
CREATE POLICY "magnify_items_delete" ON magnify_items FOR DELETE USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

-- Workstreams -----------------------------------------------------------
DROP POLICY IF EXISTS "magnify_workstreams_select" ON magnify_workstreams;
CREATE POLICY "magnify_workstreams_select" ON magnify_workstreams FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND magnify_is_approved()
  AND (
    magnify_is_stake_admin()
    OR EXISTS (
      SELECT 1 FROM magnify_workstream_members m
      WHERE m.workstream_id = magnify_workstreams.id AND m.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "magnify_workstreams_write" ON magnify_workstreams;
CREATE POLICY "magnify_workstreams_write" ON magnify_workstreams FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_ws_members_select" ON magnify_workstream_members;
CREATE POLICY "magnify_ws_members_select" ON magnify_workstream_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM magnify_workstreams w
    WHERE w.id = workstream_id AND w.stake_id IN (SELECT current_user_stake())
  )
  AND magnify_is_approved()
);

DROP POLICY IF EXISTS "magnify_ws_members_write" ON magnify_workstream_members;
CREATE POLICY "magnify_ws_members_write" ON magnify_workstream_members FOR ALL USING (
  magnify_is_stake_admin()
  AND EXISTS (
    SELECT 1 FROM magnify_workstreams w
    WHERE w.id = workstream_id AND w.stake_id IN (SELECT current_user_stake())
  )
) WITH CHECK (
  magnify_is_stake_admin()
  AND EXISTS (
    SELECT 1 FROM magnify_workstreams w
    WHERE w.id = workstream_id AND w.stake_id IN (SELECT current_user_stake())
  )
);

-- Meetings and metrics are presidency/clerk only. The high-counselor tile set
-- deliberately carries no audit, recommend or metric tiles.
DROP POLICY IF EXISTS "magnify_meetings_all" ON magnify_meetings;
CREATE POLICY "magnify_meetings_all" ON magnify_meetings FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_metrics_select" ON magnify_metrics;
CREATE POLICY "magnify_metrics_select" ON magnify_metrics FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_metrics_write" ON magnify_metrics;
CREATE POLICY "magnify_metrics_write" ON magnify_metrics FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_metric_defs_select" ON magnify_metric_defs;
CREATE POLICY "magnify_metric_defs_select" ON magnify_metric_defs FOR SELECT USING (
  magnify_is_approved()
);

-- Demo lockdown — mirrors `callings`. Demo users get client-side fixtures, not
-- real rows. Do not loosen.
DROP POLICY IF EXISTS "demo_block_all" ON magnify_items;
CREATE POLICY "demo_block_all" ON magnify_items AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_all" ON magnify_workstreams;
CREATE POLICY "demo_block_all" ON magnify_workstreams AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_all" ON magnify_workstream_members;
CREATE POLICY "demo_block_all" ON magnify_workstream_members AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_all" ON magnify_meetings;
CREATE POLICY "demo_block_all" ON magnify_meetings AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_all" ON magnify_metrics;
CREATE POLICY "demo_block_all" ON magnify_metrics AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());

-- ------------------------------------------- steward_interviews tenancy --
--
-- steward_interviews is the one Steward table the dashboard reads, and it had
-- no stake_id — Steward is per-user, Magnify is per-stake. Backfill from
-- user_stakes on the assignee, then require it. The external writer (the
-- exec-sec agent, which upserts this table via the service role) must now pass
-- stake_id; its conventions doc is updated in the same change.

ALTER TABLE steward_interviews ADD COLUMN IF NOT EXISTS stake_id uuid REFERENCES stakes(id) ON DELETE CASCADE;

UPDATE steward_interviews si
SET stake_id = us.stake_id
FROM user_stakes us
WHERE si.stake_id IS NULL
  AND us.user_id = si.assigned_to_user_id;

-- Anything still unmatched (unassigned rows) falls to the single stake that
-- owns the app today. If more than one stake exists this is a no-op and those
-- rows stay NULL rather than being guessed at.
UPDATE steward_interviews si
SET stake_id = (SELECT id FROM stakes WHERE status = 'active' LIMIT 1)
WHERE si.stake_id IS NULL
  AND (SELECT count(*) FROM stakes WHERE status = 'active') = 1;

CREATE INDEX IF NOT EXISTS idx_steward_interviews_stake ON steward_interviews(stake_id, year, quarter_num);

-- steward_interviews.stake_id has two very different writers: Magnify
-- (authenticated, has current_user_stake_single()) and Scott's exec-sec agent
-- (service role, no auth.uid()). Rather than require every writer to remember
-- the column, derive it. Only once it can't be forgotten is NOT NULL safe.
CREATE OR REPLACE FUNCTION steward_interviews_fill_stake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stake_id IS NULL AND NEW.assigned_to_user_id IS NOT NULL THEN
    SELECT us.stake_id INTO NEW.stake_id
    FROM user_stakes us WHERE us.user_id = NEW.assigned_to_user_id LIMIT 1;
  END IF;

  IF NEW.stake_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT us.stake_id INTO NEW.stake_id
    FROM user_stakes us WHERE us.user_id = auth.uid() LIMIT 1;
  END IF;

  IF NEW.stake_id IS NULL
     AND (SELECT count(*) FROM stakes WHERE status = 'active') = 1 THEN
    SELECT id INTO NEW.stake_id FROM stakes WHERE status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_steward_interviews_fill_stake ON steward_interviews;
CREATE TRIGGER trg_steward_interviews_fill_stake
  BEFORE INSERT OR UPDATE ON steward_interviews
  FOR EACH ROW EXECUTE FUNCTION steward_interviews_fill_stake();

ALTER TABLE steward_interviews ALTER COLUMN stake_id SET NOT NULL;

-- --------------------------------------------------------------- reads ---
--
-- Steward's RLS is strictly auth.uid() = user_id and steward_user_profiles is
-- self-or-admin. A direct table read from Magnify silently returns one row and
-- looks like a bug, so every cross-app read goes through SECURITY DEFINER.
--
-- SECURITY DEFINER ALSO BYPASSES RLS, which means the RESTRICTIVE
-- `demo_block_all` policies that keep the demo account away from real data DO
-- NOT APPLY inside these functions. Caught in testing 2026-08-31: the demo
-- account read the stake's real steward_interviews through
-- magnify_dash_interviews while `callings` correctly returned nothing. Every
-- function below therefore calls is_demo_user() itself. Do not remove those
-- guards, and add one to any dashboard RPC written later.

-- Quarterly interviews for the caller's stake, with assignee names.
CREATE OR REPLACE FUNCTION magnify_dash_interviews(p_year int, p_quarter int)
RETURNS TABLE (
  id uuid, interviewee_name text, interviewee_calling text,
  assigned_to_user_id uuid, assignee_name text,
  scheduled_for date, completed_at date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT si.id, si.interviewee_name, si.interviewee_calling,
         si.assigned_to_user_id, sup.full_name,
         si.scheduled_for, si.completed_at
  FROM steward_interviews si
  LEFT JOIN steward_user_profiles sup ON sup.id = si.assigned_to_user_id
  WHERE si.year = p_year
    AND si.quarter_num = p_quarter
    AND si.stake_id IN (SELECT current_user_stake())
    AND magnify_is_approved()
    AND NOT is_demo_user()
    -- A high councilor sees only his own interviews; the presidency sees all.
    AND (magnify_is_stake_admin() OR si.assigned_to_user_id = auth.uid())
  ORDER BY si.scheduled_for NULLS LAST, si.interviewee_name;
$$;

-- The caller's own recurring Steward duties for the CURRENT period, with
-- whether they're marked done. Period anchors match Steward's date-fns
-- helpers exactly: weekly = Sunday of this week, monthly = 1st of this month,
-- quarterly = 1st of the quarter. `interval`/`anchor_date` reproduce Steward's
-- isDueThisPeriod so "3 of 5" here equals what the Steward grid shows.
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
         AND MOD(
               ((due.period_start - magnify_week_start(due.anchor_date)) / 7)::int,
               due.iv
             ) = 0)
     OR (due.frequency = 'weekly' AND due.anchor_date IS NULL)
     OR due.frequency <> 'weekly'
  ORDER BY due.frequency, due.name;
$$;

-- Mark a Steward behavior done/not-done for the current period from the
-- dashboard. Shared behaviors delegate to Steward's own fan-out RPC so every
-- participant's row stays in sync — do not write steward_entries directly for
-- a shared task.
CREATE OR REPLACE FUNCTION magnify_dash_set_standard_work(p_behavior_id uuid, p_done boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_freq   text;
  v_shared uuid;
  v_period date;
  v_value  text;
BEGIN
  IF is_demo_user() THEN
    RAISE EXCEPTION 'Demo accounts cannot write standard work';
  END IF;

  SELECT frequency, shared_task_id INTO v_freq, v_shared
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
  v_value := CASE WHEN p_done THEN 'y' ELSE 'n' END;

  IF v_shared IS NOT NULL THEN
    PERFORM steward_set_shared_entry(v_shared, v_period, v_value);
    RETURN;
  END IF;

  INSERT INTO steward_entries (user_id, behavior_id, entry_date, value, completed_by)
  VALUES (auth.uid(), p_behavior_id, v_period, v_value, auth.uid())
  -- The unique key on steward_entries is (behavior_id, entry_date) — there is
  -- no user_id in it, because every participant of a shared task keeps their
  -- own behavior row. Do not add user_id to this conflict target.
  ON CONFLICT (behavior_id, entry_date)
  DO UPDATE SET value = EXCLUDED.value, completed_by = auth.uid(), updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION magnify_dash_interviews(int, int) FROM public, anon;
REVOKE ALL ON FUNCTION magnify_dash_my_standard_work() FROM public, anon;
REVOKE ALL ON FUNCTION magnify_dash_set_standard_work(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_dash_interviews(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_dash_my_standard_work() TO authenticated;
GRANT EXECUTE ON FUNCTION magnify_dash_set_standard_work(uuid, boolean) TO authenticated;
