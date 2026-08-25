-- Melchizedek Priesthood ordinations: a Stake Presidency interview queue.
--
-- History: ordinations used to be entered only AFTER the stake presidency had
-- interviewed the candidate, which is why they landed straight in HC Approval.
-- Since 2026-08-24 an ordination is entered up front and flows through the SP
-- board, so the interview now has to happen somewhere ON the board. This adds
-- the stage it happens in.
--
-- New MP path:  ideas → for_approval → stake_approved → pending_interview → hc_approval → …
-- Every other type is untouched: stake_approved still goes straight to hc_approval.
--
-- Nothing but the CHECK constraint needs to change. `callings_update` gates
-- writes on role, and only names stages inside the high-councilor branch —
-- pending_interview is not one of them, so high councilors cannot move these
-- cards, which is what we want: the presidency does the interview.

alter table callings drop constraint if exists callings_stage_check;

alter table callings add constraint callings_stage_check
  check (stage in (
    'ideas','for_approval','stake_approved','pending_interview','hc_approval',
    'issue_calling','ordained','sustain','set_apart','record','complete'
  ));
