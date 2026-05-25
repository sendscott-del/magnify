-- Magnify: high-councilor → ward assignments.
-- Each HC member can cover one or more wards. Used by the HC Kanban board's
-- Sustain column "Just mine" filter so a high councilor sees the cards that
-- still need sustaining in any of their wards (ward callings in those wards,
-- plus stake callings with unsustained ward_sustainings rows for those wards).

CREATE TABLE IF NOT EXISTS hc_member_wards (
  hc_member_id uuid NOT NULL REFERENCES high_council_members(id) ON DELETE CASCADE,
  ward_id      uuid NOT NULL REFERENCES wards(id)                ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hc_member_id, ward_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_member_wards_hc ON hc_member_wards(hc_member_id);
CREATE INDEX IF NOT EXISTS idx_hc_member_wards_ward ON hc_member_wards(ward_id);

ALTER TABLE hc_member_wards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hc_member_wards_select" ON hc_member_wards;
DROP POLICY IF EXISTS "hc_member_wards_insert" ON hc_member_wards;
DROP POLICY IF EXISTS "hc_member_wards_delete" ON hc_member_wards;

-- Read: any approved Magnify user (same posture as high_council_members).
CREATE POLICY "hc_member_wards_select" ON hc_member_wards FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
);

-- Write: stake admins from Magnify, plus Gathered super admins (so the
-- Gathered admin page can manage assignments without needing a Magnify role).
CREATE POLICY "hc_member_wards_insert" ON hc_member_wards FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
      AND role IN ('stake_president','stake_clerk','exec_secretary')
  )
  OR EXISTS (SELECT 1 FROM gather_super_admins WHERE user_id = auth.uid())
);
CREATE POLICY "hc_member_wards_delete" ON hc_member_wards FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'approved'
      AND role IN ('stake_president','stake_clerk','exec_secretary')
  )
  OR EXISTS (SELECT 1 FROM gather_super_admins WHERE user_id = auth.uid())
);
