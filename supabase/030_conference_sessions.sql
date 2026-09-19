-- Magnify 030 — stake conference sessions on the schedule (2026-09-19).
-- A conference weekend has Saturday sessions; meetings gain a day_offset
-- (-1 = the Saturday before that Sunday). A CONFERENCE body is visible to
-- every role. Applied to isogetmvnpimcmouakeg 2026-09-19 together with the
-- October 2026 Chicago sessions (from "202610_Schedule of Meetings").
ALTER TABLE magnify_schedule_meetings ADD COLUMN IF NOT EXISTS day_offset int NOT NULL DEFAULT 0 CHECK (day_offset IN (-1, 0));
ALTER TABLE magnify_schedule_meetings DROP CONSTRAINT IF EXISTS magnify_schedule_meetings_body_check;
ALTER TABLE magnify_schedule_meetings ADD CONSTRAINT magnify_schedule_meetings_body_check
  CHECK (body IN ('SP','SP_RS','HC','HC_1on1','SC','BC','ADULT_LEADERSHIP','TRAINING','WARD_CONFERENCE','CONFERENCE','OTHER'));

DO $$
DECLARE v_stake uuid; v_week uuid;
BEGIN
  SELECT id INTO v_stake FROM stakes WHERE name = 'Chicago Illinois Stake';
  SELECT id INTO v_week FROM magnify_schedule_weeks WHERE stake_id = v_stake AND sunday_on = '2026-10-11';
  IF v_week IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM magnify_schedule_meetings WHERE week_id = v_week) THEN RETURN; END IF;
  INSERT INTO magnify_schedule_meetings (stake_id, week_id, body, starts_at, ends_at, format, label, sort_order, day_offset) VALUES
    (v_stake, v_week, 'CONFERENCE', '15:30', '16:45', 'in_person', 'Ward and stake council leadership meeting (SP + RS arrive 2:30)', 1, -1),
    (v_stake, v_week, 'CONFERENCE', '17:00', '18:15', 'in_person', 'Saturday adult session', 2, -1),
    (v_stake, v_week, 'CONFERENCE', '09:30', '10:45', 'in_person', 'General session 1 (English)', 3, 0),
    (v_stake, v_week, 'CONFERENCE', '11:30', '12:45', 'in_person', 'General session 2 (Spanish)', 4, 0);
END $$;
