-- Phase 2 follow-up: scope profiles VISIBILITY by stake.
--
-- profiles is shared suite-wide (Magnify + Sparkle at minimum), so this is the
-- one re-key that touches other apps. New SELECT model:
--   • self — always
--   • Gathered super admins — everything (platform owner; needed by the hub)
--   • app='sparkle' rows — visible to any authenticated user (Sparkle's status
--     quo; it has no stake concept and filters by app client-side)
--   • otherwise — same-stake only, via a SECURITY DEFINER helper because RLS
--     applies inside policy subqueries: a direct join on user_stakes would be
--     filtered to the caller's own rows and always come up empty.
--
-- Consequence, accepted: Magnify pending signups WITHOUT an invite mapping are
-- visible only to themselves and super admins (Chicago approvals already run
-- through the hub). Invite-redeemed pending users are stake-mapped at signup,
-- so their own stake's admins see them — that's what powers the delegated
-- approval queue.
--
-- Also closes a real WRITE hole: profiles_admin_update let ANY approved
-- Magnify admin update ANY profile — cross-stake. Now: same-stake admins (or
-- super admins) only.

create or replace function user_in_my_stake(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_stakes me
    join user_stakes them on me.stake_id = them.stake_id
    where me.user_id = auth.uid() and them.user_id = target
  )
$$;
revoke all on function user_in_my_stake(uuid) from public;
grant execute on function user_in_my_stake(uuid) to authenticated;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
  or app = 'sparkle'
  or user_in_my_stake(id)
);

drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles for update using (
  (
    exists (select 1 from profiles p where p.id = auth.uid() and p.status = 'approved'
      and p.role in ('stake_president','stake_clerk','exec_secretary'))
    and user_in_my_stake(profiles.id)
  )
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
);
