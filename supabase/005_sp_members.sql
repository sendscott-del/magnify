-- Stake Presidency Members table (for task assignment, independent of user accounts)
CREATE TABLE IF NOT EXISTS sp_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('stake_president', 'first_counselor', 'second_counselor')),
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sp_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sp_members"
  ON sp_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Clerks and presidents can manage sp_members"
  ON sp_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND status = 'approved'
        AND role IN ('stake_president', 'stake_clerk')
    )
  );

-- Ensure callings delete is permitted for stake_president and stake_clerk
DROP POLICY IF EXISTS "Clerks can delete callings" ON callings;
CREATE POLICY "Clerks can delete callings"
  ON callings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND status = 'approved'
        AND role IN ('stake_president', 'stake_clerk')
    )
  );
