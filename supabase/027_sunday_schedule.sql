-- Magnify 027 — Sunday schedule on the dashboard (2026-09-19).
--
-- The app becomes the source of truth for the stake's leadership meeting
-- schedule (previously a Google Sheet read by the exec-sec agent), and the
-- dashboard grows a "This Sunday" card built from these tables: the morning
-- meetings, each presidency member's building assignment, the ward sacrament
-- times, and the drive matrix between buildings. Design: docs/DESIGN_HANDOFF.md
-- and docs/design_handoff_sunday_schedule/README.md.
--
-- Access model (enforced here, not in the client):
--   meetings              every approved user in the stake
--   building assignments  presidency + clerks only (HC/SC never see the P/1C/2C columns)
--   companion rotation    presidency + clerks, plus the named high councilor's own row
--   reminders log         presidency + clerks
--   week notes            presidency only
-- A new profile role `stake_council` joins the app with this release. It sees
-- the calendar and its own items and nothing about callings.
--
-- Every policy reaches other tables only through the SECURITY DEFINER helpers
-- (022/024/025) — never a direct subquery of a sibling dashboard table.

-- ------------------------------------------------------------- new role --

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('stake_president','first_counselor','second_counselor',
                  'high_councilor','stake_clerk','exec_secretary','stake_council',
                  'owner','staff'));

-- Callings, approvals and the log are the presidency's and high council's.
-- A stake council member is approved for the app but must not read them.
CREATE OR REPLACE FUNCTION magnify_is_stake_council()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND app = 'magnify' AND role = 'stake_council'
  );
$$;
REVOKE ALL ON FUNCTION magnify_is_stake_council() FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_is_stake_council() TO authenticated;

DROP POLICY IF EXISTS "no_callings_for_stake_council" ON callings;
CREATE POLICY "no_callings_for_stake_council" ON callings AS RESTRICTIVE FOR ALL
  USING (NOT magnify_is_stake_council()) WITH CHECK (NOT magnify_is_stake_council());
DROP POLICY IF EXISTS "no_callings_for_stake_council" ON hc_approvals;
CREATE POLICY "no_callings_for_stake_council" ON hc_approvals AS RESTRICTIVE FOR ALL
  USING (NOT magnify_is_stake_council()) WITH CHECK (NOT magnify_is_stake_council());
DROP POLICY IF EXISTS "no_callings_for_stake_council" ON calling_log;
CREATE POLICY "no_callings_for_stake_council" ON calling_log AS RESTRICTIVE FOR ALL
  USING (NOT magnify_is_stake_council()) WITH CHECK (NOT magnify_is_stake_council());

-- ------------------------------------------------------------ buildings --

CREATE TABLE IF NOT EXISTS magnify_buildings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id    uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  short_name  text NOT NULL,
  address     text,
  sort_order  int  NOT NULL DEFAULT 0,
  UNIQUE (stake_id, short_name)
);

-- One row per ward: where and when its sacrament meeting is. LCR Unit
-- Settings is the authority; this is a copy the presidency maintains.
CREATE TABLE IF NOT EXISTS magnify_ward_meeting_times (
  ward_id      uuid PRIMARY KEY REFERENCES wards(id) ON DELETE CASCADE,
  stake_id     uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  building_id  uuid NOT NULL REFERENCES magnify_buildings(id) ON DELETE RESTRICT,
  sacrament_at time NOT NULL,
  duration_min int  NOT NULL DEFAULT 70
);

-- Directed drive matrix. Missing pair = unknown, the card says so rather
-- than guessing.
CREATE TABLE IF NOT EXISTS magnify_travel_minutes (
  stake_id         uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  from_building_id uuid NOT NULL REFERENCES magnify_buildings(id) ON DELETE CASCADE,
  to_building_id   uuid NOT NULL REFERENCES magnify_buildings(id) ON DELETE CASCADE,
  minutes          int  NOT NULL CHECK (minutes >= 0),
  PRIMARY KEY (from_building_id, to_building_id)
);

-- Per-stake settings the schedule needs: the building that is "the stake
-- offices", the two standing Zoom lines, and the Tidings ids the text
-- reminder goes through. Secrets never live here — only ids and links.
CREATE TABLE IF NOT EXISTS magnify_stake_settings (
  stake_id               uuid PRIMARY KEY DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  offices_building_id    uuid REFERENCES magnify_buildings(id) ON DELETE SET NULL,
  sp_zoom_url            text,
  sp_zoom_note           text,
  leadership_zoom_url    text,
  leadership_zoom_note   text,
  tidings_sender_id      uuid,
  tidings_hc_list_id     uuid,
  tidings_sc_list_id     uuid,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- schedule --

CREATE TABLE IF NOT EXISTS magnify_schedule_weeks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id      uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  sunday_on     date NOT NULL,
  kind          text NOT NULL DEFAULT 'meetings'
                  CHECK (kind IN ('meetings','holiday','stake_conference','general_conference','ward_conference','none')),
  holiday_label text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stake_id, sunday_on)
);

CREATE TABLE IF NOT EXISTS magnify_schedule_meetings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id   uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  week_id    uuid NOT NULL REFERENCES magnify_schedule_weeks(id) ON DELETE CASCADE,
  body       text NOT NULL
               CHECK (body IN ('SP','SP_RS','HC','HC_1on1','SC','BC','ADULT_LEADERSHIP','TRAINING','WARD_CONFERENCE','OTHER')),
  starts_at  time NOT NULL,
  ends_at    time NOT NULL,
  format     text NOT NULL DEFAULT 'in_person' CHECK (format IN ('in_person','zoom')),
  label      text,
  sort_order int  NOT NULL DEFAULT 0,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_magnify_schedule_meetings_week ON magnify_schedule_meetings(week_id);

-- Building assignments: which ward(s) each presidency seat visits. Kept out
-- of the weeks row so RLS can hide the whole table from HC and SC.
CREATE TABLE IF NOT EXISTS magnify_schedule_assignments (
  stake_id uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  week_id  uuid NOT NULL REFERENCES magnify_schedule_weeks(id) ON DELETE CASCADE,
  seat     text NOT NULL CHECK (seat IN ('P','1C','2C')),
  ward_id  uuid NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  PRIMARY KEY (week_id, seat, ward_id)
);

-- Presidency-only free text on a Sunday. Separate table so the row-level
-- rule can differ from the meetings everyone sees.
CREATE TABLE IF NOT EXISTS magnify_schedule_notes (
  week_id  uuid PRIMARY KEY REFERENCES magnify_schedule_weeks(id) ON DELETE CASCADE,
  stake_id uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  note     text NOT NULL DEFAULT ''
);

-- Which high councilor accompanies the president that Sunday. A one-line
-- reason only; nothing about capacity or circumstances belongs in the app.
CREATE TABLE IF NOT EXISTS magnify_hc_rotation (
  week_id      uuid PRIMARY KEY REFERENCES magnify_schedule_weeks(id) ON DELETE CASCADE,
  stake_id     uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  hc_member_id uuid NOT NULL REFERENCES high_council_members(id) ON DELETE CASCADE,
  reason       text
);

-- Every reminder the app sent, which is also the double-send guard.
CREATE TABLE IF NOT EXISTS magnify_reminders_sent (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id        uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  week_id         uuid NOT NULL REFERENCES magnify_schedule_weeks(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('slack','tidings')),
  target          text NOT NULL,          -- webhook event_type, or the Tidings list ids
  body            text NOT NULL,
  recipient_count int,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  sent_by         uuid DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_magnify_reminders_week ON magnify_reminders_sent(week_id, channel);

DROP TRIGGER IF EXISTS trg_magnify_schedule_weeks_touch ON magnify_schedule_weeks;
CREATE TRIGGER trg_magnify_schedule_weeks_touch BEFORE UPDATE ON magnify_schedule_weeks
  FOR EACH ROW EXECUTE FUNCTION magnify_touch_updated_at();

-- ------------------------------------------------------------------ RLS --

ALTER TABLE magnify_buildings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_ward_meeting_times   ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_travel_minutes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_stake_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_schedule_weeks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_schedule_meetings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_schedule_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_hc_rotation          ENABLE ROW LEVEL SECURITY;
ALTER TABLE magnify_reminders_sent       ENABLE ROW LEVEL SECURITY;

-- Reference data: everyone approved reads, stake admins write.
DROP POLICY IF EXISTS "magnify_buildings_select" ON magnify_buildings;
CREATE POLICY "magnify_buildings_select" ON magnify_buildings FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_approved()
);
DROP POLICY IF EXISTS "magnify_buildings_write" ON magnify_buildings;
CREATE POLICY "magnify_buildings_write" ON magnify_buildings FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_wmt_select" ON magnify_ward_meeting_times;
CREATE POLICY "magnify_wmt_select" ON magnify_ward_meeting_times FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_approved()
);
DROP POLICY IF EXISTS "magnify_wmt_write" ON magnify_ward_meeting_times;
CREATE POLICY "magnify_wmt_write" ON magnify_ward_meeting_times FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_travel_select" ON magnify_travel_minutes;
CREATE POLICY "magnify_travel_select" ON magnify_travel_minutes FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_approved()
);
DROP POLICY IF EXISTS "magnify_travel_write" ON magnify_travel_minutes;
CREATE POLICY "magnify_travel_write" ON magnify_travel_minutes FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

-- Settings carry the Zoom links: presidency + clerks read (they post the
-- reminders), presidency writes.
DROP POLICY IF EXISTS "magnify_stake_settings_select" ON magnify_stake_settings;
CREATE POLICY "magnify_stake_settings_select" ON magnify_stake_settings FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);
DROP POLICY IF EXISTS "magnify_stake_settings_write" ON magnify_stake_settings;
CREATE POLICY "magnify_stake_settings_write" ON magnify_stake_settings FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_presidency()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_presidency()
);

-- Weeks and meetings: the calendar everyone sees. The client filters the
-- meeting bodies per role for display; the rows themselves are not secret.
DROP POLICY IF EXISTS "magnify_weeks_select" ON magnify_schedule_weeks;
CREATE POLICY "magnify_weeks_select" ON magnify_schedule_weeks FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_approved()
);
DROP POLICY IF EXISTS "magnify_weeks_write" ON magnify_schedule_weeks;
CREATE POLICY "magnify_weeks_write" ON magnify_schedule_weeks FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_meetings_select" ON magnify_schedule_meetings;
CREATE POLICY "magnify_meetings_select" ON magnify_schedule_meetings FOR SELECT USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_approved()
);
DROP POLICY IF EXISTS "magnify_meetings_write" ON magnify_schedule_meetings;
CREATE POLICY "magnify_meetings_write" ON magnify_schedule_meetings FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

-- Building assignments and the reminders log: presidency + clerks only.
DROP POLICY IF EXISTS "magnify_assignments_all" ON magnify_schedule_assignments;
CREATE POLICY "magnify_assignments_all" ON magnify_schedule_assignments FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

DROP POLICY IF EXISTS "magnify_reminders_all" ON magnify_reminders_sent;
CREATE POLICY "magnify_reminders_all" ON magnify_reminders_sent FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

-- Notes: presidency only.
DROP POLICY IF EXISTS "magnify_notes_all" ON magnify_schedule_notes;
CREATE POLICY "magnify_notes_all" ON magnify_schedule_notes FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_presidency()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_presidency()
);

-- Companion rotation: admins see all; a high councilor sees the weeks he is
-- the companion for. `magnify_is_my_hc_member` avoids subquerying
-- high_council_members inside the policy of a table it might join later.
CREATE OR REPLACE FUNCTION magnify_is_my_hc_member(p_member uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM high_council_members
    WHERE id = p_member AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION magnify_is_my_hc_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_is_my_hc_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "magnify_rotation_select" ON magnify_hc_rotation;
CREATE POLICY "magnify_rotation_select" ON magnify_hc_rotation FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND (magnify_is_stake_admin() OR magnify_is_my_hc_member(hc_member_id))
);
DROP POLICY IF EXISTS "magnify_rotation_write" ON magnify_hc_rotation;
CREATE POLICY "magnify_rotation_write" ON magnify_hc_rotation FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);

-- The demo account never reads a real stake's schedule.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'magnify_buildings','magnify_ward_meeting_times','magnify_travel_minutes',
    'magnify_stake_settings','magnify_schedule_weeks','magnify_schedule_meetings',
    'magnify_schedule_assignments','magnify_schedule_notes','magnify_hc_rotation',
    'magnify_reminders_sent'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "demo_block_all" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "demo_block_all" ON %I AS RESTRICTIVE FOR ALL USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user())',
      tbl);
  END LOOP;
END $$;

-- ------------------------------------------- interviews: per-role reads --
--
-- The design review (2026-09-19) narrowed who sees the quarterly interview
-- queue: the president sees all, a counselor his own, the clerk and executive
-- secretary none, and a high councilor only the date of his own interview.
-- The RPC is SECURITY DEFINER (Steward's RLS is self-only), so the narrowing
-- has to happen here rather than in a policy.

CREATE OR REPLACE FUNCTION magnify_dash_interviews(p_year int, p_quarter int)
RETURNS TABLE (
  id uuid, interviewee_name text, interviewee_calling text,
  assigned_to_user_id uuid, assignee_name text,
  scheduled_for date, completed_at date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
             si.assigned_to_user_id, sup.full_name, si.scheduled_for, si.completed_at
      FROM steward_interviews si
      LEFT JOIN steward_user_profiles sup ON sup.id = si.assigned_to_user_id
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake());
  ELSIF v_role IN ('first_counselor','second_counselor') THEN
    RETURN QUERY
      SELECT si.id, si.interviewee_name, si.interviewee_calling,
             si.assigned_to_user_id, sup.full_name, si.scheduled_for, si.completed_at
      FROM steward_interviews si
      LEFT JOIN steward_user_profiles sup ON sup.id = si.assigned_to_user_id
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake())
        AND si.assigned_to_user_id = auth.uid();
  ELSIF v_role = 'high_councilor' THEN
    -- Date only: no calling, no assignee, no completion state.
    RETURN QUERY
      SELECT si.id, si.interviewee_name, NULL::text,
             NULL::uuid, NULL::text, si.scheduled_for, si.completed_at
      FROM steward_interviews si
      WHERE si.year = p_year AND si.quarter_num = p_quarter
        AND si.stake_id IN (SELECT current_user_stake())
        AND si.interviewee_name = v_name;
  END IF;
  -- stake_clerk, exec_secretary, stake_council: nothing.
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION magnify_dash_interviews(int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION magnify_dash_interviews(int, int) TO authenticated;
