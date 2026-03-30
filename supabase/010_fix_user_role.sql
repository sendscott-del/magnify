-- Fix role for Ricardo Samways: registered as stake_clerk but is a High Councilor
UPDATE profiles
SET role = 'high_councilor'
WHERE full_name = 'Ricardo Samways';
