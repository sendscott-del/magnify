-- Phase 2: invite-code joins + delegated per-stake approval.
--
-- The missing onboarding plumbing that lets a SECOND stake actually operate:
--   • stake_invites — codes a stake's admin hands to their own members. A
--     joiner redeems at signup, which writes their user_stakes mapping while
--     still pending. That mapping is what routes them to the RIGHT stake
--     (handle_magnify_approval's not-exists guard then leaves it alone) and
--     makes them visible to their own stake's admins (profiles same-stake
--     policy) — powering the delegated queue.
--   • magnify_approve_member / magnify_deny_member — same-stake admins (or
--     super admins) decide their own people. No more everything-through-Scott.
--   • gather_approve_stake_request now also approves the requester's Magnify
--     profile as stake_president — before this, an approved stake's first
--     admin was still locked out of the app (profile stuck pending).

create table if not exists stake_invites (
  id          uuid primary key default gen_random_uuid(),
  stake_id    uuid not null references stakes(id) on delete cascade,
  code        text not null unique,
  created_by  uuid references profiles(id) on delete set null,
  max_uses    int not null default 20,
  use_count   int not null default 0,
  expires_at  timestamptz not null default now() + interval '30 days',
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_stake_invites_stake on stake_invites(stake_id);
alter table stake_invites enable row level security;

-- Reads: same-stake only (admins list/revoke their own codes). Writes: RPCs.
drop policy if exists "stake_invites_select" on stake_invites;
create policy "stake_invites_select" on stake_invites for select using (
  stake_id in (select current_user_stake())
);

-- Create an invite for the caller's own stake. Caller must be a Magnify admin
-- or the stake's first admin (user_stakes.role = 'stake_admin').
create or replace function gather_create_stake_invite()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_stake uuid;
  v_code text;
BEGIN
  v_stake := current_user_stake_single();
  IF v_stake IS NULL THEN
    RAISE EXCEPTION 'gather_create_stake_invite: you do not belong to a stake yet';
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
      AND role IN ('stake_president','stake_clerk','exec_secretary'))
    OR EXISTS (SELECT 1 FROM user_stakes WHERE user_id = auth.uid()
      AND stake_id = v_stake AND role = 'stake_admin')
  ) THEN
    RAISE EXCEPTION 'gather_create_stake_invite: requires a stake admin';
  END IF;

  v_code := upper(left(replace(gen_random_uuid()::text, '-', ''), 8));
  INSERT INTO stake_invites (stake_id, code, created_by)
  VALUES (v_stake, v_code, auth.uid());
  RETURN v_code;
END;
$function$;
revoke all on function gather_create_stake_invite() from public;
grant execute on function gather_create_stake_invite() to authenticated;

-- Redeem at signup: maps the (pending) caller into the invite's stake.
create or replace function gather_redeem_stake_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_invite record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gather_redeem_stake_invite: not signed in';
  END IF;

  SELECT si.* INTO v_invite
  FROM stake_invites si
  JOIN stakes s ON s.id = si.stake_id AND s.status = 'active'
  WHERE si.code = upper(trim(p_code))
    AND si.revoked_at IS NULL
    AND si.expires_at > now()
    AND si.use_count < si.max_uses
  FOR UPDATE OF si;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gather_redeem_stake_invite: invalid or expired invite code';
  END IF;

  INSERT INTO user_stakes (user_id, stake_id)
  VALUES (auth.uid(), v_invite.stake_id)
  ON CONFLICT (user_id, stake_id) DO NOTHING;

  UPDATE stake_invites SET use_count = use_count + 1 WHERE id = v_invite.id;
  RETURN v_invite.stake_id;
END;
$function$;
revoke all on function gather_redeem_stake_invite(text) from public;
grant execute on function gather_redeem_stake_invite(text) to authenticated;

-- Delegated approval: same-stake admins (or super admins) approve/deny their
-- own pending members. The profiles-status trigger handles user_apps and the
-- Chicago default mapping (skipped when an invite already mapped the user).
create or replace function magnify_approve_member(p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF p_role NOT IN ('stake_president','first_counselor','second_counselor',
                    'high_councilor','stake_clerk','exec_secretary') THEN
    RAISE EXCEPTION 'magnify_approve_member: invalid role %', p_role;
  END IF;
  IF NOT (
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
       AND role IN ('stake_president','stake_clerk','exec_secretary'))
     AND user_in_my_stake(p_user_id))
    OR EXISTS (SELECT 1 FROM gather_super_admins WHERE user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'magnify_approve_member: requires an admin of the member''s stake';
  END IF;

  UPDATE profiles SET status = 'approved', role = p_role
  WHERE id = p_user_id AND app = 'magnify';
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE user_stakes SET role = p_role WHERE user_id = p_user_id;
  RETURN true;
END;
$function$;
revoke all on function magnify_approve_member(uuid, text) from public;
grant execute on function magnify_approve_member(uuid, text) to authenticated;

create or replace function magnify_deny_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF NOT (
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
       AND role IN ('stake_president','stake_clerk','exec_secretary'))
     AND user_in_my_stake(p_user_id))
    OR EXISTS (SELECT 1 FROM gather_super_admins WHERE user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'magnify_deny_member: requires an admin of the member''s stake';
  END IF;

  UPDATE profiles SET status = 'rejected'
  WHERE id = p_user_id AND app = 'magnify' AND status = 'pending';
  RETURN FOUND;
END;
$function$;
revoke all on function magnify_deny_member(uuid) from public;
grant execute on function magnify_deny_member(uuid) to authenticated;

-- Approving a stake request now also unlocks the requester's Magnify profile
-- as stake_president (no-op for users without a Magnify profile).
create or replace function gather_approve_stake_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_req record;
  v_slug text;
  v_stake uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gather_super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'gather_approve_stake_request: requires super-admin';
  END IF;

  SELECT * INTO v_req FROM public.stake_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gather_approve_stake_request: request % not found', p_request_id;
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'gather_approve_stake_request: request already %', v_req.status;
  END IF;

  v_slug := trim(both '-' from regexp_replace(lower(v_req.proposed_name), '[^a-z0-9]+', '-', 'g'));
  IF v_slug = '' THEN v_slug := 'stake'; END IF;
  IF EXISTS (SELECT 1 FROM public.stakes WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 4);
  END IF;

  INSERT INTO public.stakes (name, abbreviation, slug, created_by)
  VALUES (v_req.proposed_name, v_req.proposed_abbreviation, v_slug, v_req.requester_user_id)
  RETURNING id INTO v_stake;

  INSERT INTO public.user_stakes (user_id, stake_id, role)
  VALUES (v_req.requester_user_id, v_stake, 'stake_admin')
  ON CONFLICT (user_id, stake_id) DO UPDATE SET role = 'stake_admin';

  -- Unlock their Magnify profile as the new stake's president. Their mapping
  -- already exists, so the profiles-status trigger's not-exists guard leaves
  -- it untouched (no Chicago default).
  UPDATE public.profiles SET status = 'approved', role = 'stake_president'
  WHERE id = v_req.requester_user_id AND app = 'magnify';

  UPDATE public.stake_requests
  SET status = 'approved', decided_by = auth.uid(), decided_at = now()
  WHERE id = p_request_id;

  RETURN v_stake;
END;
$function$;
