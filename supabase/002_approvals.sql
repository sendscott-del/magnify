-- Magnify: Approval tracking tables
-- Run this in Supabase SQL Editor after schema.sql

-- ─────────────────────────────────────────────
-- HIGH COUNCIL MEMBERS
-- ─────────────────────────────────────────────
create table if not exists high_council_members (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- STAKE PRESIDENCY APPROVALS (one row per calling per role)
-- ─────────────────────────────────────────────
create table if not exists stake_presidency_approvals (
  id uuid default uuid_generate_v4() primary key,
  calling_id uuid references callings(id) on delete cascade not null,
  role text not null check (role in ('stake_president','first_counselor','second_counselor')),
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references profiles(id) on delete set null,
  unique (calling_id, role)
);

-- ─────────────────────────────────────────────
-- HC APPROVALS (one row per calling per HC member)
-- ─────────────────────────────────────────────
create table if not exists hc_approvals (
  id uuid default uuid_generate_v4() primary key,
  calling_id uuid references callings(id) on delete cascade not null,
  hc_member_id uuid references high_council_members(id) on delete cascade not null,
  approved boolean not null default false,
  approved_at timestamptz,
  unique (calling_id, hc_member_id)
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table high_council_members enable row level security;
alter table stake_presidency_approvals enable row level security;
alter table hc_approvals enable row level security;

drop policy if exists "hcm_select" on high_council_members;
drop policy if exists "hcm_insert" on high_council_members;
drop policy if exists "hcm_update" on high_council_members;
drop policy if exists "hcm_delete" on high_council_members;

create policy "hcm_select" on high_council_members for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "hcm_insert" on high_council_members for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
);
create policy "hcm_update" on high_council_members for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
);
create policy "hcm_delete" on high_council_members for delete using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved'
    and role in ('stake_president','stake_clerk','exec_secretary'))
);

drop policy if exists "sp_approvals_select" on stake_presidency_approvals;
drop policy if exists "sp_approvals_insert" on stake_presidency_approvals;
drop policy if exists "sp_approvals_update" on stake_presidency_approvals;

create policy "sp_approvals_select" on stake_presidency_approvals for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "sp_approvals_insert" on stake_presidency_approvals for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "sp_approvals_update" on stake_presidency_approvals for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);

drop policy if exists "hc_approvals_select" on hc_approvals;
drop policy if exists "hc_approvals_insert" on hc_approvals;
drop policy if exists "hc_approvals_update" on hc_approvals;

create policy "hc_approvals_select" on hc_approvals for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "hc_approvals_insert" on hc_approvals for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "hc_approvals_update" on hc_approvals for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
