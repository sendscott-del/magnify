-- Magnify: link a high-council roster entry to a registered user account.
-- Previously the app matched a logged-in user to their roster row by exact
-- full-name string (fragile). This adds a hard user_id link so the HC board
-- and calling assignments recognize the right person regardless of spelling.
ALTER TABLE high_council_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- An account links to at most one roster entry.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_high_council_members_user
  ON high_council_members(user_id) WHERE user_id IS NOT NULL;
