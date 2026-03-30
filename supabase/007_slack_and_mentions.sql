-- Fix: Allow any authenticated user (including pending) to read slack_settings
-- This is needed so newly registered users can trigger access request Slack notifications
DROP POLICY IF EXISTS "slack_settings_select" ON slack_settings;
CREATE POLICY "slack_settings_select" ON slack_settings FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Add Slack user ID columns to HC and SP member tables for @mention support
ALTER TABLE high_council_members ADD COLUMN IF NOT EXISTS slack_user_id text;
ALTER TABLE sp_members ADD COLUMN IF NOT EXISTS slack_user_id text;
