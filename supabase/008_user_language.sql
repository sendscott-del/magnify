-- Store language preference on the user's profile so it follows them across devices
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'en'
  CHECK (language IN ('en', 'es'));
