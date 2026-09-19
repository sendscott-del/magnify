-- Magnify 031 — presidency calendar events (2026-09-19).
-- Events from the Chicago Stake Presidency Google Calendar, synced by the
-- magnify-sync-google-calendar edge function from the calendar's secret iCal
-- address (secret MAGNIFY_GCAL_ICS_URL on the shared project; pg_cron calls
-- the function every 30 minutes, see 032). Presidency + clerks only. Times
-- are timestamptz; the app renders them in America/Chicago.
CREATE TABLE IF NOT EXISTS magnify_calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id    uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'google',
  source_id   text NOT NULL,              -- uid + occurrence start, unique per stake
  title       text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  all_day     boolean NOT NULL DEFAULT false,
  location    text,
  description text,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stake_id, source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_magnify_calendar_events_start ON magnify_calendar_events(stake_id, starts_at);

ALTER TABLE magnify_calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "magnify_calendar_events_all" ON magnify_calendar_events;
CREATE POLICY "magnify_calendar_events_all" ON magnify_calendar_events FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND magnify_is_stake_admin()
);
DROP POLICY IF EXISTS "demo_block_all" ON magnify_calendar_events;
CREATE POLICY "demo_block_all" ON magnify_calendar_events AS RESTRICTIVE FOR ALL
  USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());

ALTER TABLE magnify_stake_settings ADD COLUMN IF NOT EXISTS calendar_synced_at timestamptz;
