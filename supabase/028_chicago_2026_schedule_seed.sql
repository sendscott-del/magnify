-- Magnify 028 — one-time import of the Chicago Illinois Stake 2026 schedule
-- (2026-09-19). Source: the "Chicago Stake Leadership Meetings" Google Sheet,
-- current-year block, read the day the app took over as source of truth.
-- Buildings, sacrament times and the drive matrix come from the exec-sec
-- command file (LCR Unit Settings verified 2026-08-09).
--
-- Stake-specific. Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- Other stakes get their reference data through the app, not a migration.

-- Temporary helper so each meeting row is one line below. Dropped at the end.
CREATE OR REPLACE PROCEDURE magnify_seed_meeting(
  p_stake uuid, p_week uuid, p_body text, p_start time, p_end time, p_format text, p_label text, p_sort int
) LANGUAGE sql AS $$
  INSERT INTO magnify_schedule_meetings (stake_id, week_id, body, starts_at, ends_at, format, label, sort_order)
  VALUES (p_stake, p_week, p_body, p_start, p_end, p_format, p_label, p_sort);
$$;

DO $$
DECLARE
  v_stake uuid;
  b_pulaski uuid; b_hp uuid; b_wc uuid; b_bi uuid; b_mv uuid;
  w_bi uuid; w_c2 uuid; w_hp1 uuid; w_hp2 uuid; w_hp3 uuid; w_mw uuid; w_mv uuid; w_w1 uuid; w_w2 uuid;
  v_week uuid;
BEGIN
  SELECT id INTO v_stake FROM stakes WHERE name = 'Chicago Illinois Stake';
  IF v_stake IS NULL THEN RAISE NOTICE 'Chicago stake not found; skipping seed'; RETURN; END IF;

  -- Buildings ---------------------------------------------------------------
  INSERT INTO magnify_buildings (stake_id, name, short_name, address, sort_order) VALUES
    (v_stake, 'Stake center (Pulaski)', 'Pulaski',        '3250 S Pulaski Rd, Chicago IL 60623',        1),
    (v_stake, 'Hyde Park',              'Hyde Park',      '5200 S University Ave, Chicago IL 60615',    2),
    (v_stake, 'Westchester',            'Westchester',    '1550 S Haase Ave, Westchester IL 60153',     3),
    (v_stake, 'Blue Island',            'Blue Island',    '11107 S Vincennes Ave, Chicago IL 60643',    4),
    (v_stake, 'Moraine Valley',         'Moraine Valley', '13150 S 88th Ave, Palos Park IL 60462',      5)
  ON CONFLICT (stake_id, short_name) DO NOTHING;

  SELECT id INTO b_pulaski FROM magnify_buildings WHERE stake_id = v_stake AND short_name = 'Pulaski';
  SELECT id INTO b_hp      FROM magnify_buildings WHERE stake_id = v_stake AND short_name = 'Hyde Park';
  SELECT id INTO b_wc      FROM magnify_buildings WHERE stake_id = v_stake AND short_name = 'Westchester';
  SELECT id INTO b_bi      FROM magnify_buildings WHERE stake_id = v_stake AND short_name = 'Blue Island';
  SELECT id INTO b_mv      FROM magnify_buildings WHERE stake_id = v_stake AND short_name = 'Moraine Valley';

  SELECT id INTO w_bi  FROM wards WHERE stake_id = v_stake AND abbreviation = 'BI';
  SELECT id INTO w_c2  FROM wards WHERE stake_id = v_stake AND abbreviation = 'CH2';
  SELECT id INTO w_hp1 FROM wards WHERE stake_id = v_stake AND abbreviation = 'HP1';
  SELECT id INTO w_hp2 FROM wards WHERE stake_id = v_stake AND abbreviation = 'HP2';
  SELECT id INTO w_hp3 FROM wards WHERE stake_id = v_stake AND abbreviation = 'HP3';
  SELECT id INTO w_mw  FROM wards WHERE stake_id = v_stake AND abbreviation = 'MW';
  SELECT id INTO w_mv  FROM wards WHERE stake_id = v_stake AND abbreviation = 'MV';
  SELECT id INTO w_w1  FROM wards WHERE stake_id = v_stake AND abbreviation = 'WC1';
  SELECT id INTO w_w2  FROM wards WHERE stake_id = v_stake AND abbreviation = 'WC2';

  -- Ward sacrament times (LCR Unit Settings, verified 2026-08-09) ---------
  INSERT INTO magnify_ward_meeting_times (ward_id, stake_id, building_id, sacrament_at) VALUES
    (w_mw,  v_stake, b_pulaski, '09:00'),
    (w_c2,  v_stake, b_pulaski, '11:30'),
    (w_hp3, v_stake, b_hp,      '09:00'),
    (w_hp1, v_stake, b_hp,      '11:30'),
    (w_hp2, v_stake, b_hp,      '14:00'),
    (w_w1,  v_stake, b_wc,      '09:00'),
    (w_w2,  v_stake, b_wc,      '12:00'),
    (w_bi,  v_stake, b_bi,      '10:00'),
    (w_mv,  v_stake, b_mv,      '10:00')
  ON CONFLICT (ward_id) DO NOTHING;

  -- Drive matrix (minutes, from the sheet) ----------------------------------
  INSERT INTO magnify_travel_minutes (stake_id, from_building_id, to_building_id, minutes) VALUES
    (v_stake, b_hp, b_bi, 28), (v_stake, b_hp, b_pulaski, 22), (v_stake, b_hp, b_mv, 40), (v_stake, b_hp, b_wc, 33),
    (v_stake, b_bi, b_hp, 28), (v_stake, b_bi, b_pulaski, 25), (v_stake, b_bi, b_mv, 30), (v_stake, b_bi, b_wc, 35),
    (v_stake, b_pulaski, b_hp, 22), (v_stake, b_pulaski, b_bi, 25), (v_stake, b_pulaski, b_mv, 35), (v_stake, b_pulaski, b_wc, 28),
    (v_stake, b_mv, b_hp, 40), (v_stake, b_mv, b_bi, 30), (v_stake, b_mv, b_pulaski, 35), (v_stake, b_mv, b_wc, 50),
    (v_stake, b_wc, b_hp, 33), (v_stake, b_wc, b_bi, 35), (v_stake, b_wc, b_pulaski, 28), (v_stake, b_wc, b_mv, 50)
  ON CONFLICT (from_building_id, to_building_id) DO NOTHING;

  -- Stake settings ----------------------------------------------------------
  INSERT INTO magnify_stake_settings
    (stake_id, offices_building_id, sp_zoom_url, sp_zoom_note, leadership_zoom_url, leadership_zoom_note,
     tidings_sender_id, tidings_hc_list_id, tidings_sc_list_id)
  VALUES
    (v_stake, b_pulaski,
     'https://zoom.us/j/91037048607?pwd=ke6t7bBpQlrOqyKA9TbU2aVh1Wt6h4.1', 'ID 910 3704 8607, passcode 932726',
     'https://zoom.us/j/97234049239?pwd=Xbi1FmXn4mabDU4LDN0SSQWWvGJ4Lo.1', 'ID 972 3404 9239, passcode 492009',
     '11897aaf-61ec-446e-a228-0d55eb59c55f',
     'f2d26b00-95a5-4096-9919-0b202fbfcbb4',
     '7b96bea3-9e55-4995-8abd-b6a9ecd7efc0')
  ON CONFLICT (stake_id) DO NOTHING;

  -- 2026 Sundays ------------------------------------------------------------
  -- Only insert Sundays that are not already there, so a re-run never
  -- overwrites edits made in the app.
  IF EXISTS (SELECT 1 FROM magnify_schedule_weeks WHERE stake_id = v_stake AND sunday_on >= '2026-01-01') THEN
    RAISE NOTICE '2026 weeks already present; skipping schedule rows';
    RETURN;
  END IF;

  -- Each block: week row, meetings, P (and 1C) assignments. The sheet gave
  -- start-only times for the older rows; SP is assumed 30 min and every
  -- other meeting 60 min (section 0 defaults). In person unless the sheet
  -- said Zoom or virtual.

  -- Q1
  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-01-04', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '08:00', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w2), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-01-11', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '09:00', '10:10', 'in_person', 'HP1 and HP2', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, '1C', w_hp1), (v_stake, v_week, '1C', w_hp2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-01-18', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP_RS', '08:00', '09:00', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, '1C', w_mw), (v_stake, v_week, '1C', w_c2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-01-25', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '10:00', '11:10', 'in_person', 'Moraine Valley', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_mv), (v_stake, v_week, '1C', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-02-01', 'stake_conference');

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-02-08', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '09:00', '10:10', 'in_person', 'Westchester 1st', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, '1C', w_w1);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-02-15', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '08:00', '08:30', 'in_person', NULL, 2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-02-22', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '12:00', '13:10', 'in_person', 'Westchester 2nd', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w2), (v_stake, v_week, '1C', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-03-01', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'BC', '07:00', '08:00', 'in_person', NULL, 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp3), (v_stake, v_week, '1C', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-03-08', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '10:00', '11:10', 'in_person', 'Blue Island', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, '1C', w_hp3), (v_stake, v_week, '1C', w_bi);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-03-15', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP_RS', '08:00', '09:00', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, 'P', w_hp3), (v_stake, v_week, '1C', w_c2), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-03-22', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '09:00', '10:10', 'in_person', 'Midway; Hyde Park 2nd', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_mw), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-03-29', 'holiday', 'Palm Sunday') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  -- Q2
  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-04-05', 'general_conference', 'Easter');

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-04-12', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC_1on1', '08:00', '09:00', 'in_person', 'HC PPIs', 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_mv), (v_stake, v_week, '1C', w_hp3);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-04-19', 'none', 'Cancelled: area presidency in town') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, '1C', w_c2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-04-26', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '09:00', '10:10', 'in_person', 'Hyde Park 3rd', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp3), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, '1C', w_hp3);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-05-03', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'BC', '07:00', '08:00', 'in_person', NULL, 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-05-10', 'holiday', 'Mothers'' Day') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, '1C', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-05-17', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_c2), (v_stake, v_week, 'P', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-05-24', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:00', 'zoom', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_mv), (v_stake, v_week, 'P', w_bi);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-05-31', 'ward_conference') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'WARD_CONFERENCE', '11:30', '12:40', 'in_person', 'Chicago 2nd', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_c2), (v_stake, v_week, '1C', w_c2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-06-07', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'ADULT_LEADERSHIP', '08:00', '09:00', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-06-14', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, 'P', w_hp3);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-06-21', 'holiday', 'Fathers'' Day') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-06-28', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'TRAINING', '07:00', '08:00', 'zoom', 'Expanded Stake Adult Leadership (ward EQ, RS, Stake Council)', 1);

  -- Q3
  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-07-05', 'holiday', 'Independence Day');

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-07-12', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP_RS', '07:30', '08:30', 'zoom', 'Stake conference planning', 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, '1C', w_hp2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-07-19', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'zoom', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, '1C', w_c2), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-07-26', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:00', 'zoom', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, 'P', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-08-02', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'BC', '07:00', '08:00', 'in_person', NULL, 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, 'P', w_hp3);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-08-09', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC_1on1', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-08-16', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, '1C', w_c2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-08-23', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:00', 'zoom', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2), (v_stake, v_week, '1C', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-08-30', 'none') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-09-06', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '08:00', 'in_person', 'View Sacred Funds video', 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'ADULT_LEADERSHIP', '08:00', '09:00', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-09-13', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_c2), (v_stake, v_week, 'P', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-09-20', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SP_RS', '08:30', '09:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, 'P', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-09-27', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'TRAINING', '07:00', '08:00', 'zoom', 'Expanded Stake Adult Leadership (ward EQ, RS, Stake Council)', 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, 'P', w_hp3);

  -- Q4
  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-10-04', 'general_conference');
  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-10-11', 'stake_conference');

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-10-18', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-10-25', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'zoom', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:00', 'zoom', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_c2), (v_stake, v_week, 'P', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-11-01', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'BC', '07:00', '08:00', 'in_person', NULL, 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, 'P', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-11-08', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'HC_1on1', '07:00', '08:00', 'in_person', NULL, 1);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1), (v_stake, v_week, 'P', w_hp2), (v_stake, v_week, 'P', w_hp3);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-11-15', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'SC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-11-22', 'holiday', 'Thanksgiving') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_c2), (v_stake, v_week, 'P', w_mw);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-11-29', 'holiday', 'Thanksgiving') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-12-06', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '08:00', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'ADULT_LEADERSHIP', '08:00', '09:00', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_bi), (v_stake, v_week, 'P', w_mv);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind) VALUES (v_stake, '2026-12-13', 'meetings') RETURNING id INTO v_week;
  CALL magnify_seed_meeting(v_stake, v_week, 'SP', '07:00', '07:30', 'in_person', NULL, 1);
  CALL magnify_seed_meeting(v_stake, v_week, 'HC', '07:30', '08:30', 'in_person', NULL, 2);
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_w1), (v_stake, v_week, 'P', w_w2);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-12-20', 'holiday', 'Christmas') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1);

  INSERT INTO magnify_schedule_weeks (stake_id, sunday_on, kind, holiday_label) VALUES (v_stake, '2026-12-27', 'holiday', 'Christmas') RETURNING id INTO v_week;
  INSERT INTO magnify_schedule_assignments (stake_id, week_id, seat, ward_id) VALUES (v_stake, v_week, 'P', w_hp1);
END $$;

DROP PROCEDURE IF EXISTS magnify_seed_meeting(uuid, uuid, text, time, time, text, text, int);
