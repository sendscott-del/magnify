-- A high councilor could not hand a calling to the next stage.
--
-- `callings_update` had a USING clause and NO WITH CHECK. For UPDATE, Postgres
-- falls back to evaluating USING against the NEW row when WITH CHECK is absent.
-- The USING clause ties a high councilor's write permission to the stage they
-- are assigned on, so the check ran like this for "Ready to Set Apart":
--
--   USING      (old row, stage='sustain')   sustain_by  = me -> passes
--   WITH CHECK (new row, stage='set_apart') set_apart_by = me -> FAILS
--
-- The whole point of a stage is that the assigned person finishes their step and
-- hands off to someone else, so the owner of the next stage is almost never the
-- same person. Every high-council advance therefore raised "new row violates
-- row-level security policy" — and the client ignored the error, wrote a
-- calling_log entry, and showed a success message, so the card silently stayed
-- put and a clerk had to move it by hand. Reported 2026-08-23 with an activity
-- log showing five identical Sustain -> Set Apart entries on one card.
--
-- Fix: keep USING exactly as it was — it still decides WHICH rows a high
-- councilor may touch, namely only ones they are assigned on — and add an
-- explicit WITH CHECK that validates the resulting row without re-requiring
-- stage ownership. An assigned high councilor can now move their own card
-- forward; they still cannot touch a card they are not assigned on, or one
-- belonging to another stake.
--
-- Note: `demo_block_all` is RESTRICTIVE, so it still ANDs on top of this and
-- the demo account remains locked out.

drop policy if exists "callings_update" on callings;

create policy "callings_update" on callings
for update
using (
  stake_id in (select current_user_stake())
  and exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.app = 'magnify'
      and profiles.status = 'approved'
      and (
        profiles.role = any (array['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'])
        or (
          profiles.role = 'high_councilor'
          and exists (
            select 1 from high_council_members hm
            where hm.user_id = auth.uid()
              and hm.active = true
              and (
                   (callings.stage = any (array['issue_calling','ordained']) and callings.extend_by = hm.name)
                or (callings.stage = 'sustain'   and callings.sustain_by = hm.name)
                or (callings.stage = 'set_apart' and callings.set_apart_by = hm.name)
              )
          )
        )
      )
  )
)
with check (
  stake_id in (select current_user_stake())
  and exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.app = 'magnify'
      and profiles.status = 'approved'
      and (
        profiles.role = any (array['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'])
        or profiles.role = 'high_councilor'
      )
  )
);
