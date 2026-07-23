-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-tenant STAGE 2 — Magnify RLS re-key (Magnify = Phase-2 pilot app)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds stake_id to every stake-scoped Magnify table, backfills to tenant #1,
-- sets NOT NULL, and rewrites every RLS policy to enforce
--   stake_id IN (SELECT current_user_stake())
-- on top of the existing app/role checks. After this, a user in stake B cannot
-- read or write a single row of stake A — reads included.
--
-- Design notes:
-- • stake_id gets DEFAULT current_user_stake_single() so existing app inserts
--   (which don't mention stake_id) keep working untouched — the row lands in
--   the author's own stake. Multi-stake users get their first mapping; today
--   every user belongs to at most one stake.
-- • The gather_super_admins bypass on the HC roster (016/018) is kept BUT now
--   also requires same-stake membership: a platform owner manages only the
--   stake(s) they belong to via user_stakes. This closes the "super admin sees
--   every stake's pastoral content" hole (tracker north-star #5).
-- • handle_magnify_approval also creates the user_stakes mapping on approval.
--   TEMP: defaults to tenant #1 when the user has no mapping yet — correct
--   while all signups are ours. A second stake's FIRST ADMIN gets their
--   mapping from gather_approve_stake_request BEFORE approval, so the
--   not-exists guard protects them. Their members need the invite-code flow
--   (Phase 2b) before that stake can take signups.
-- • Slack is OUR STAKE ONLY (Scott, 2026-07-09): reads scoped to same-stake,
--   with a stakeless-pending fallback so the pre-approval signup notify keeps
--   working. Users mapped to another stake read nothing → all notify* helpers
--   silently no-op for them, which is the desired behavior.
-- • DEFERRED, documented: profiles SELECT re-key ships as its own follow-up
--   migration (table is shared with Sparkle); the push edge function is
--   scoped in a separate deploy. FORCE RLS is not used: the gather_*
--   SECURITY DEFINER RPCs (add/rename wards) rely on owner bypass.

-- 0. Scalar resolver (column defaults can't take a setof function) ─────────────
create or replace function current_user_stake_single()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select stake_id from user_stakes where user_id = auth.uid() limit 1
$$;
revoke all on function current_user_stake_single() from public;
grant execute on function current_user_stake_single() to authenticated;

-- 1. stake_id everywhere: add → default → backfill → NOT NULL ──────────────────
-- wards.stake_id exists from Stage 1; give it the default + NOT NULL here.
alter table wards alter column stake_id set default current_user_stake_single();
alter table wards alter column stake_id set not null;

do $$
declare
  t text;
  chicago uuid := (select id from stakes where slug = 'chicago-illinois');
begin
  foreach t in array array[
    'callings','ward_sustainings','calling_log','high_council_members',
    'sp_members','hc_member_wards','hc_approvals','stake_presidency_approvals',
    'slack_settings'
  ] loop
    execute format('alter table %I add column if not exists stake_id uuid references stakes(id)', t);
    execute format('alter table %I alter column stake_id set default current_user_stake_single()', t);
    execute format('create index if not exists idx_%s_stake on %I(stake_id)', t, t);
    execute format('update %I set stake_id = $1 where stake_id is null', t) using chicago;
    execute format('alter table %I alter column stake_id set not null', t);
  end loop;
end $$;

-- 2. user_stakes mapping on approval (TEMP single-tenant default) ──────────────
create or replace function handle_magnify_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO user_apps (user_id, app_name)
    VALUES (NEW.id, 'magnify')
    ON CONFLICT (user_id, app_name) DO NOTHING;

    -- Stake mapping: without one, an approved user passes no Stage-2 policy and
    -- sees nothing. TEMP default = tenant #1 (all signups are ours today). A
    -- 2nd stake's first admin already has a mapping from
    -- gather_approve_stake_request, so the guard leaves it untouched; their
    -- members arrive via the invite-code flow (Phase 2b).
    IF NOT EXISTS (SELECT 1 FROM user_stakes WHERE user_id = NEW.id) THEN
      INSERT INTO user_stakes (user_id, stake_id, role)
      SELECT NEW.id, s.id, NEW.role FROM stakes s WHERE s.slug = 'chicago-illinois'
      ON CONFLICT (user_id, stake_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. RLS re-key ────────────────────────────────────────────────────────────────
-- Shorthand used below: SAME_STAKE = stake_id in (select current_user_stake())

-- wards ────────────────────────────────────────────────────────────────────────
drop policy if exists "wards_select" on wards;
create policy "wards_select" on wards for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);

-- callings ─────────────────────────────────────────────────────────────────────
drop policy if exists "callings_select" on callings;
create policy "callings_select" on callings for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved')
);
drop policy if exists "callings_insert" on callings;
create policy "callings_insert" on callings for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
  and created_by = auth.uid()
);
drop policy if exists "callings_update" on callings;
create policy "callings_update" on callings for update using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and (
        role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary')
        or (role = 'high_councilor' and exists (
          select 1 from high_council_members hm
          where hm.user_id = auth.uid() and hm.active = true
            and (
              (callings.stage in ('issue_calling','ordained') and callings.extend_by = hm.name)
              or (callings.stage = 'sustain'   and callings.sustain_by   = hm.name)
              or (callings.stage = 'set_apart' and callings.set_apart_by = hm.name)
            )
        ))
      ))
);
drop policy if exists "callings_delete" on callings;
create policy "callings_delete" on callings for delete using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'))
);

-- ward_sustainings ─────────────────────────────────────────────────────────────
drop policy if exists "ward_sustainings_select" on ward_sustainings;
create policy "ward_sustainings_select" on ward_sustainings for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
drop policy if exists "ward_sustainings_insert" on ward_sustainings;
create policy "ward_sustainings_insert" on ward_sustainings for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary','high_councilor'))
);
drop policy if exists "ward_sustainings_update" on ward_sustainings;
create policy "ward_sustainings_update" on ward_sustainings for update using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary','high_councilor'))
);

-- calling_log ──────────────────────────────────────────────────────────────────
drop policy if exists "calling_log_select" on calling_log;
create policy "calling_log_select" on calling_log for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved')
);
drop policy if exists "calling_log_insert" on calling_log;
create policy "calling_log_insert" on calling_log for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
  and performed_by = auth.uid()
);

-- high_council_members (super-admin clause kept, but now same-stake only) ──────
drop policy if exists "hcm_select" on high_council_members;
create policy "hcm_select" on high_council_members for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
drop policy if exists "hcm_insert" on high_council_members;
create policy "hcm_insert" on high_council_members for insert with check (
  stake_id in (select current_user_stake())
  and (
    exists (select 1 from profiles where id = auth.uid() and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
    or exists (select 1 from gather_super_admins where user_id = auth.uid())
  )
);
drop policy if exists "hcm_update" on high_council_members;
create policy "hcm_update" on high_council_members for update using (
  stake_id in (select current_user_stake())
  and (
    exists (select 1 from profiles where id = auth.uid() and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
    or exists (select 1 from gather_super_admins where user_id = auth.uid())
  )
);
drop policy if exists "hcm_delete" on high_council_members;
create policy "hcm_delete" on high_council_members for delete using (
  stake_id in (select current_user_stake())
  and (
    exists (select 1 from profiles where id = auth.uid() and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
    or exists (select 1 from gather_super_admins where user_id = auth.uid())
  )
);

-- hc_member_wards ──────────────────────────────────────────────────────────────
drop policy if exists "hc_member_wards_select" on hc_member_wards;
create policy "hc_member_wards_select" on hc_member_wards for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
drop policy if exists "hc_member_wards_insert" on hc_member_wards;
create policy "hc_member_wards_insert" on hc_member_wards for insert with check (
  stake_id in (select current_user_stake())
  and (
    exists (select 1 from profiles where id = auth.uid() and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
    or exists (select 1 from gather_super_admins where user_id = auth.uid())
  )
);
drop policy if exists "hc_member_wards_delete" on hc_member_wards;
create policy "hc_member_wards_delete" on hc_member_wards for delete using (
  stake_id in (select current_user_stake())
  and (
    exists (select 1 from profiles where id = auth.uid() and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
    or exists (select 1 from gather_super_admins where user_id = auth.uid())
  )
);

-- hc_approvals ─────────────────────────────────────────────────────────────────
drop policy if exists "hc_approvals_select" on hc_approvals;
create policy "hc_approvals_select" on hc_approvals for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
drop policy if exists "hc_approvals_insert" on hc_approvals;
create policy "hc_approvals_insert" on hc_approvals for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary','high_councilor'))
);
drop policy if exists "hc_approvals_update" on hc_approvals;
create policy "hc_approvals_update" on hc_approvals for update using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary','high_councilor'))
);

-- stake_presidency_approvals ───────────────────────────────────────────────────
drop policy if exists "sp_approvals_select" on stake_presidency_approvals;
create policy "sp_approvals_select" on stake_presidency_approvals for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
drop policy if exists "sp_approvals_insert" on stake_presidency_approvals;
create policy "sp_approvals_insert" on stake_presidency_approvals for insert with check (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'))
);
drop policy if exists "sp_approvals_update" on stake_presidency_approvals;
create policy "sp_approvals_update" on stake_presidency_approvals for update using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = auth.uid() and app = 'magnify' and status = 'approved'
      and role in ('stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'))
);

-- sp_members ───────────────────────────────────────────────────────────────────
drop policy if exists "sp_members_select_approved_magnify" on sp_members;
create policy "sp_members_select_approved_magnify" on sp_members for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = (select auth.uid()) and status = 'approved')
);
drop policy if exists "Clerks and presidents can manage sp_members" on sp_members;
create policy "Clerks and presidents can manage sp_members" on sp_members for all using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = (select auth.uid()) and status = 'approved'
      and role in ('stake_president','stake_clerk'))
);

-- slack_settings — OUR STAKE ONLY (Scott's call 2026-07-09). Reads: same-stake,
-- plus stakeless (pending, pre-approval) users so the signup flow can still
-- notify admins — those users belong to no stake yet, and today all such
-- signups are ours. A user mapped to a DIFFERENT stake cannot read our webhook.
drop policy if exists "slack_settings_select" on slack_settings;
create policy "slack_settings_select" on slack_settings for select using (
  stake_id in (select current_user_stake())
  or (auth.role() = 'authenticated'
      and not exists (select 1 from user_stakes where user_id = auth.uid()))
);
drop policy if exists "slack_settings_manage" on slack_settings;
create policy "slack_settings_manage" on slack_settings for all using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles
    where id = (select auth.uid()) and status = 'approved'
      and role in ('stake_president','stake_clerk','exec_secretary'))
);
