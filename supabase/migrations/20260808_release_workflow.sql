-- Standalone release workflow.
--
-- A "release" is an announcement-only card: member X is released from calling
-- Y. No new calling, no HC approval, no extend/set-apart/record. Flow:
--   created (presidency only, lands in for_approval) → stake president
--   approves → sustain (HC board announces it) → complete.
-- type stays ward_calling / stake_calling so the existing sustain routing is
-- untouched: a ward release reaches the covering high councilor via
-- hc_member_wards, a stake-wide release (type stake_calling) collects per-ward
-- sustainings like any stake calling. The stage short-circuit lives in
-- lib/permissions.ts.

alter table callings add column if not exists is_release boolean not null default false;

-- Only stake presidency members may create a release (any approved user may
-- still create normal callings, unchanged).
drop policy if exists "callings_insert" on callings;
create policy "callings_insert" on callings for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
  and created_by = auth.uid()
  and (
    is_release = false
    or exists (select 1 from profiles
      where id = auth.uid() and app = 'magnify' and status = 'approved'
        and role in ('stake_president','first_counselor','second_counselor'))
  )
);
