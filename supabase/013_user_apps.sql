-- Track which apps each user has access to (for cross-app switcher)
CREATE TABLE user_apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, app_name)
);

CREATE INDEX idx_user_apps_user ON user_apps(user_id);

ALTER TABLE user_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own apps"
  ON user_apps FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert own apps"
  ON user_apps FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Backfill existing approved Magnify users
INSERT INTO user_apps (user_id, app_name)
SELECT id, 'magnify' FROM profiles
WHERE status = 'approved'
ON CONFLICT (user_id, app_name) DO NOTHING;

-- Backfill existing approved Steward users
INSERT INTO user_apps (user_id, app_name)
SELECT id, 'steward' FROM steward_user_profiles
WHERE status = 'approved'
ON CONFLICT (user_id, app_name) DO NOTHING;

-- Auto-register Magnify users on approval
CREATE OR REPLACE FUNCTION handle_magnify_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO user_apps (user_id, app_name)
    VALUES (NEW.id, 'magnify')
    ON CONFLICT (user_id, app_name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_magnify_user_approved
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_magnify_approval();

-- Auto-register Steward users on approval
CREATE OR REPLACE FUNCTION handle_steward_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO user_apps (user_id, app_name)
    VALUES (NEW.id, 'steward')
    ON CONFLICT (user_id, app_name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_steward_user_approved
  AFTER INSERT OR UPDATE ON steward_user_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_steward_approval();
