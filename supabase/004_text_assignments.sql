-- Change task assignment columns from UUID (profile FK) to text (display names)
-- This allows assigning to HC members who may not have user accounts yet

ALTER TABLE callings DROP CONSTRAINT IF EXISTS callings_extend_by_fkey;
ALTER TABLE callings DROP CONSTRAINT IF EXISTS callings_sustain_by_fkey;
ALTER TABLE callings DROP CONSTRAINT IF EXISTS callings_set_apart_by_fkey;
ALTER TABLE callings DROP CONSTRAINT IF EXISTS callings_record_by_fkey;

ALTER TABLE callings
  ALTER COLUMN extend_by TYPE text USING NULL,
  ALTER COLUMN sustain_by TYPE text USING NULL,
  ALTER COLUMN set_apart_by TYPE text USING NULL,
  ALTER COLUMN record_by TYPE text USING NULL;
