-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-tenant foundation — STAGE 1 (shared Supabase project isoget…)
-- ─────────────────────────────────────────────────────────────────────────────
-- Additive only. Creates the tenant entity + user→stake mapping + the boundary
-- resolver, adds a nullable wards.stake_id, and backfills the existing stake as
-- tenant #1. It changes NO existing RLS and NO app behavior — the boundary
-- exists and is populated, but nothing enforces it yet (that is Stage 2).
--
-- See ~/claude-cos/actions/gathered-multitenant.md (Phase 1) and the approved
-- plan. NOT NULL on wards.stake_id is deliberately DEFERRED — the Gather hub's
-- gather_add_ward() RPC inserts wards without a stake_id today, so a NOT NULL
-- now would break ward creation. Tighten to NOT NULL in Stage 2 after every
-- wards writer supplies stake_id.

-- 1. Tenant entity ────────────────────────────────────────────────────────────
create table if not exists stakes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  abbreviation  text,
  slug          text unique,
  status        text not null default 'active' check (status in ('active','suspended')),
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table stakes enable row level security;

-- 2. User → stake mapping ──────────────────────────────────────────────────────
-- A join (not profiles.stake_id) because a user may belong to more than one
-- stake and the suite model wants role PER stake. profiles.role is left in place
-- for now; Stage 2 shifts Magnify's role checks onto this table.
create table if not exists user_stakes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  stake_id    uuid not null references stakes(id) on delete cascade,
  role        text,
  created_at  timestamptz not null default now(),
  unique (user_id, stake_id)
);
create index if not exists idx_user_stakes_user  on user_stakes(user_id);
create index if not exists idx_user_stakes_stake on user_stakes(stake_id);
alter table user_stakes enable row level security;

-- 3. Boundary resolver ─────────────────────────────────────────────────────────
-- The single helper every Stage-2 RLS policy will call. SECURITY DEFINER so it
-- reads user_stakes regardless of that table's own RLS. Returns the set of
-- stake_ids the caller belongs to.
create or replace function current_user_stake()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select stake_id from user_stakes where user_id = auth.uid()
$$;
revoke all on function current_user_stake() from public;
grant execute on function current_user_stake() to authenticated;

-- 4. wards.stake_id (nullable; backfilled in step 6; NOT NULL deferred) ─────────
alter table wards add column if not exists stake_id uuid references stakes(id);
create index if not exists idx_wards_stake on wards(stake_id);

-- 5. Vetted tenant-request flow ────────────────────────────────────────────────
create table if not exists stake_requests (
  id                     uuid primary key default gen_random_uuid(),
  requester_user_id      uuid not null references profiles(id) on delete cascade,
  proposed_name          text not null,
  proposed_abbreviation  text,
  status                 text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by             uuid references profiles(id) on delete set null,
  decided_at             timestamptz,
  created_at             timestamptz not null default now()
);
alter table stake_requests enable row level security;

-- Minimal, safe policies (deny-all otherwise). No cross-stake exposure.
drop policy if exists "stakes_select_own" on stakes;
create policy "stakes_select_own" on stakes for select using (
  id in (select stake_id from user_stakes where user_id = auth.uid())
);

drop policy if exists "user_stakes_select_own" on user_stakes;
create policy "user_stakes_select_own" on user_stakes for select using (
  user_id = auth.uid()
);

drop policy if exists "stake_requests_insert_own" on stake_requests;
create policy "stake_requests_insert_own" on stake_requests for insert with check (
  requester_user_id = auth.uid()
);
drop policy if exists "stake_requests_select_own" on stake_requests;
create policy "stake_requests_select_own" on stake_requests for select using (
  requester_user_id = auth.uid()
  or exists (select 1 from gather_super_admins where user_id = auth.uid())
);

-- 6. Backfill: existing stake becomes tenant #1 (idempotent) ────────────────────
insert into stakes (name, abbreviation, slug)
select 'Chicago Illinois Stake', 'CHI', 'chicago-illinois'
where not exists (select 1 from stakes where slug = 'chicago-illinois');

update wards
set stake_id = (select id from stakes where slug = 'chicago-illinois')
where stake_id is null;

insert into user_stakes (user_id, stake_id, role)
select p.id, (select id from stakes where slug = 'chicago-illinois'), p.role
from profiles p
where p.app = 'magnify' and p.status = 'approved'
  and not exists (
    select 1 from user_stakes us
    where us.user_id = p.id
      and us.stake_id = (select id from stakes where slug = 'chicago-illinois')
  );
