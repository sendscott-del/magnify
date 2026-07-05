-- Magnify: let Gathered super admins manage the high council roster.
-- Migration 002 scoped high_council_members writes to Magnify stake roles only
-- (stake_president / stake_clerk / exec_secretary). Migration 016 later opened
-- hc_member_wards to gather_super_admins so the Gathered admin page could manage
-- ward coverage without a Magnify role — but the roster itself (add / rename /
-- remove a high councilor) was still Magnify-only. Mirror 016 here so the
-- Gathered admin's "High councilor ward coverage" section can manage members too.

drop policy if exists "hcm_insert" on high_council_members;
drop policy if exists "hcm_update" on high_council_members;
drop policy if exists "hcm_delete" on high_council_members;

create policy "hcm_insert" on high_council_members for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
);
create policy "hcm_update" on high_council_members for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
);
create policy "hcm_delete" on high_council_members for delete using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
);
