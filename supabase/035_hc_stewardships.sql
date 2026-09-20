-- What a high councilor is over, beyond his wards.
--
-- Asked for 2026-09-20: routing the Protecting Children and Youth training
-- follow-ups needs "the high councilor over seminary", and nothing in the
-- database could answer it. `high_council_members` is name, active, sort
-- order, user id and Slack id — a ward map (`hc_member_wards`) but no
-- stewardship.
--
-- Shaped exactly like `hc_member_wards`, deliberately: a join table, not a
-- column, because a high councilor usually holds more than one stewardship,
-- and the roster screen already knows how to render a chip row backed by a
-- join table. Same RLS, same per-command demo blocks.
--
-- The vocabulary is a CHECK rather than a lookup table. It is a short, stable
-- list of stake organizations; `constants/stewardships.ts` holds the same keys
-- for the UI and the two must be edited together. A lookup table would buy
-- per-stake vocabularies nobody has asked for.

CREATE TABLE IF NOT EXISTS hc_member_stewardships (
  hc_member_id uuid NOT NULL REFERENCES high_council_members(id) ON DELETE CASCADE,
  stewardship  text NOT NULL CHECK (stewardship IN (
    'seminary','temple_family_history','missionary','welfare_self_reliance',
    'young_men','young_women','primary','relief_society','elders_quorum',
    'sunday_school','single_adults','emergency_prep'
  )),
  stake_id     uuid NOT NULL DEFAULT current_user_stake_single() REFERENCES stakes(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hc_member_id, stewardship)
);

CREATE INDEX IF NOT EXISTS idx_hc_member_stewardships_lookup
  ON hc_member_stewardships(stake_id, stewardship);

ALTER TABLE hc_member_stewardships ENABLE ROW LEVEL SECURITY;

-- Everyone approved in the stake reads it; only the president, clerks and the
-- executive secretary write it. Copied from hc_member_wards so the roster
-- screen's two chip rows behave identically.
DROP POLICY IF EXISTS "hc_member_stewardships_select" ON hc_member_stewardships;
CREATE POLICY "hc_member_stewardships_select" ON hc_member_stewardships FOR SELECT USING (
  stake_id IN (SELECT current_user_stake())
  AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved')
);

DROP POLICY IF EXISTS "hc_member_stewardships_insert" ON hc_member_stewardships;
CREATE POLICY "hc_member_stewardships_insert" ON hc_member_stewardships FOR INSERT WITH CHECK (
  stake_id IN (SELECT current_user_stake())
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
              AND profiles.role IN ('stake_president','stake_clerk','exec_secretary'))
    OR EXISTS (SELECT 1 FROM gather_super_admins WHERE gather_super_admins.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "hc_member_stewardships_delete" ON hc_member_stewardships;
CREATE POLICY "hc_member_stewardships_delete" ON hc_member_stewardships FOR DELETE USING (
  stake_id IN (SELECT current_user_stake())
  AND (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
              AND profiles.role IN ('stake_president','stake_clerk','exec_secretary'))
    OR EXISTS (SELECT 1 FROM gather_super_admins WHERE gather_super_admins.user_id = auth.uid())
  )
);

-- Per-command demo blocks, matching hc_member_wards (which leaves SELECT open).
DROP POLICY IF EXISTS "demo_block_insert" ON hc_member_stewardships;
CREATE POLICY "demo_block_insert" ON hc_member_stewardships
  AS RESTRICTIVE FOR INSERT WITH CHECK (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_update" ON hc_member_stewardships;
CREATE POLICY "demo_block_update" ON hc_member_stewardships
  AS RESTRICTIVE FOR UPDATE USING (NOT is_demo_user());
DROP POLICY IF EXISTS "demo_block_delete" ON hc_member_stewardships;
CREATE POLICY "demo_block_delete" ON hc_member_stewardships
  AS RESTRICTIVE FOR DELETE USING (NOT is_demo_user());
