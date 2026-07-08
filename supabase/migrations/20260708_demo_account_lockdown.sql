-- Demo/reviewer account lockdown (applied to prod 2026-07-08).
--
-- The shared demo login `applereview@gatheredin.app` is an approved Magnify
-- `stake_president`, used as the "Try the demo" / App Review account across the
-- Gathered church suite. Magnify's demo experience is client-side fixtures, but
-- the account's Supabase session could still read confidential `callings` (member
-- names, releases, rejection notes) and mutate real church records via the API.
--
-- Magnify's login gate requires status='approved', so we can't just delete/downgrade
-- the profile without dead-ending the reviewer on the Pending screen (and Magnify is
-- a native app, so a client-side gate change would need a rebuild + break the live
-- demo until shipped). Instead we neutralize the account at the DB layer with
-- RESTRICTIVE policies that AND with existing policies. These are provably no-ops for
-- real users (is_demo=false for all of them) and deny only flagged demo profiles.
--
-- Verified in prod: the demo session reads 0 rows from callings/calling_log, is denied
-- writes (403 on insert, 0-row no-op on update/delete), and still loads its own profile
-- so the live demo keeps working with no app rebuild.

-- 1) Flag demo profiles.
alter table public.profiles add column if not exists is_demo boolean not null default false;
update public.profiles set is_demo = true
  where id = '22f33e18-f1c5-4336-9bc0-1de83b64fd46' and app = 'magnify';

-- 2) Helper: is the current auth user a flagged demo account?
create or replace function public.is_demo_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_demo = true);
$$;

do $$
declare t text;
begin
  -- 3) Confidential + calling-workflow tables: block the demo entirely (read+write).
  --    Magnify shows client-side fixtures here, so a full block is invisible to the reviewer.
  foreach t in array array[
    'callings','calling_log','hc_approvals','stake_presidency_approvals','ward_sustainings'
  ] loop
    execute format('drop policy if exists demo_block_all on public.%I', t);
    execute format('create policy demo_block_all on public.%I as restrictive for all to public using (not public.is_demo_user()) with check (not public.is_demo_user())', t);
  end loop;

  -- 4) Roster / config / profiles: block demo WRITES only; preserve read so any
  --    non-demo-gated UI still renders for the reviewer.
  foreach t in array array[
    'high_council_members','hc_member_wards','sp_members','wards','slack_settings','profiles'
  ] loop
    execute format('drop policy if exists demo_block_insert on public.%I', t);
    execute format('drop policy if exists demo_block_update on public.%I', t);
    execute format('drop policy if exists demo_block_delete on public.%I', t);
    execute format('create policy demo_block_insert on public.%I as restrictive for insert to public with check (not public.is_demo_user())', t);
    execute format('create policy demo_block_update on public.%I as restrictive for update to public using (not public.is_demo_user())', t);
    execute format('create policy demo_block_delete on public.%I as restrictive for delete to public using (not public.is_demo_user())', t);
  end loop;
end $$;
