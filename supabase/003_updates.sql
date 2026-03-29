-- Magnify: Schema updates batch 3
-- Run in Supabase SQL Editor

-- Make ward optional
ALTER TABLE callings ALTER COLUMN ward_id DROP NOT NULL;

-- Task assignment columns
ALTER TABLE callings ADD COLUMN IF NOT EXISTS extend_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE callings ADD COLUMN IF NOT EXISTS sustain_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE callings ADD COLUMN IF NOT EXISTS set_apart_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE callings ADD COLUMN IF NOT EXISTS record_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- SP approvals: allow stake_clerk and exec_secretary as optional signatories
ALTER TABLE stake_presidency_approvals DROP CONSTRAINT IF EXISTS stake_presidency_approvals_role_check;
ALTER TABLE stake_presidency_approvals ADD CONSTRAINT stake_presidency_approvals_role_check
  CHECK (role IN ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'));

-- Slack settings
CREATE TABLE IF NOT EXISTS slack_settings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type text NOT NULL DEFAULT 'stage_change',
  webhook_url text NOT NULL,
  channel_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE slack_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "slack_settings_select" ON slack_settings;
DROP POLICY IF EXISTS "slack_settings_manage" ON slack_settings;
CREATE POLICY "slack_settings_select" ON slack_settings FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
);
CREATE POLICY "slack_settings_manage" ON slack_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
    AND role IN ('stake_president','stake_clerk','exec_secretary'))
);

-- Slack user mapping for DM notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_user_id text;
