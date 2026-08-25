-- "Stake Interview" task assignment for Melchizedek Priesthood ordinations.
--
-- Pending Interview (migration 020) had no assignee, so the presidency was
-- badged collectively and nothing on the card said whose interview it was.
-- This is the slot that names the person. It is only rendered for MP
-- ordinations, and only stake presidency members can be picked into it — the
-- interview is theirs to hold.
--
-- Same shape as the other assignment columns (extend_by / sustain_by /
-- set_apart_by / record_by): a plain text name matched against the roster, not
-- a foreign key. Keeping the shape identical is deliberate — the assignment UI,
-- the advance gate, the badge counts and the Slack @mention lookup all read
-- these columns positionally.
--
-- No RLS change: `callings_update` gates on role, not on which columns change.

alter table callings add column if not exists interview_by text;

comment on column callings.interview_by is
  'Stake presidency member assigned to interview the candidate (mp_ordination only).';
