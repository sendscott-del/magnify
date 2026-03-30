-- Expand sp_members role to include Stake Clerk and Executive Secretary
ALTER TABLE sp_members DROP CONSTRAINT IF EXISTS sp_members_role_check;
ALTER TABLE sp_members ADD CONSTRAINT sp_members_role_check
  CHECK (role IN ('stake_president', 'first_counselor', 'second_counselor', 'stake_clerk', 'exec_secretary'));
