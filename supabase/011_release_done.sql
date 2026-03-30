-- Add release_done flag to track when the release has been completed
ALTER TABLE callings ADD COLUMN IF NOT EXISTS release_done BOOLEAN DEFAULT FALSE;
