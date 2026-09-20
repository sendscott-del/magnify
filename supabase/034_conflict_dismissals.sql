-- "Clear" a schedule conflict the app raised that the human knows is fine.
--
-- The This Sunday card flags overlaps, missing drive times and too-short gaps
-- in red. Some of those are real. Some are the app not knowing something the
-- president does — a training that is already in the building he is driving
-- to, a 5-minute gap he is content with, a set-apart he will hold in the foyer
-- on the way past. Before this there was no way to acknowledge one: the red
-- stayed forever, and a standing false alarm trains people to ignore the real
-- ones.
--
-- Per USER, not per stake. The timeline is built from one person's seat — the
-- president's conflicts are not the second counselor's — so a dismissal is
-- only ever about the row that person is looking at.
--
-- Keyed by sunday_on and a structural conflict key, NOT by week_id or
-- meeting id, for two reasons:
--   1. saveWeek() deletes and re-inserts every meeting row on every save, so
--      meeting ids are not stable across an edit.
--   2. A conflict can come from Google Calendar events alone, on a Sunday
--      with no magnify_schedule_weeks row at all.
--
-- The key (see conflictKey() in lib/schedule.ts) is built from clock times and
-- building ids, never from the rendered sentence — it must not change between
-- English and Spanish. It DOES change when the schedule changes, which is the
-- point: move the meeting and the dismissal stops applying, so a cleared
-- conflict can never hide a new, real one behind it.

CREATE TABLE IF NOT EXISTS magnify_schedule_conflict_dismissals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id     uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL DEFAULT auth.uid(),
  sunday_on    date NOT NULL,
  conflict_key text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stake_id, user_id, sunday_on, conflict_key)
);

CREATE INDEX IF NOT EXISTS idx_magnify_conflict_dismissals_lookup
  ON magnify_schedule_conflict_dismissals(stake_id, user_id, sunday_on);

ALTER TABLE magnify_schedule_conflict_dismissals ENABLE ROW LEVEL SECURITY;

-- Own rows only, inside own stake. A dismissal is a private note-to-self about
-- one's own day; nobody else reads or clears it.
DROP POLICY IF EXISTS "magnify_conflict_dismissals_own" ON magnify_schedule_conflict_dismissals;
CREATE POLICY "magnify_conflict_dismissals_own" ON magnify_schedule_conflict_dismissals FOR ALL USING (
  stake_id IN (SELECT current_user_stake()) AND user_id = auth.uid() AND magnify_is_approved()
) WITH CHECK (
  stake_id IN (SELECT current_user_stake()) AND user_id = auth.uid() AND magnify_is_approved()
);

-- Same restrictive demo lock as every other schedule table (027).
DROP POLICY IF EXISTS "demo_block_all" ON magnify_schedule_conflict_dismissals;
CREATE POLICY "demo_block_all" ON magnify_schedule_conflict_dismissals
  AS RESTRICTIVE FOR ALL USING (NOT is_demo_user()) WITH CHECK (NOT is_demo_user());
