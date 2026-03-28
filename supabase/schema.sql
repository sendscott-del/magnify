-- Magnify Schema
-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- Drop Magnify-specific tables only (safe to recreate)
drop table if exists calling_log cascade;
drop table if exists ward_sustainings cascade;
drop table if exists callings cascade;
drop table if exists wards cascade;

-- Drop old trigger if exists
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- ─────────────────────────────────────────────
-- PROFILES (shared table — alter to add Magnify columns if missing)
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null default '',
  role text not null default 'stake_clerk',
  created_at timestamptz default now()
);

-- Add Magnify-specific columns if they don't exist
alter table profiles add column if not exists status text not null default 'pending'
  check (status in ('pending','approved','rejected'));

-- Drop old role constraint if it exists and add the Magnify one
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('stake_president','first_counselor','second_counselor','high_councilor','stake_clerk','exec_secretary'));

-- ─────────────────────────────────────────────
-- WARDS
-- ─────────────────────────────────────────────
create table wards (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  abbreviation text not null,
  sort_order integer default 0
);

-- ─────────────────────────────────────────────
-- CALLINGS
-- ─────────────────────────────────────────────
create table callings (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('ward_calling','stake_calling','mp_ordination')),
  member_name text not null,
  calling_name text not null,
  ordination_type text check (ordination_type in ('elder','high_priest')),
  ward_id uuid references wards(id) on delete restrict not null,
  stage text not null default 'ideas'
    check (stage in ('ideas','for_approval','stake_approved','hc_approval','issue_calling','ordained','sustain','set_apart','record','complete')),
  rejected boolean not null default false,
  rejection_notes text,
  org_recommended boolean default false,
  bishop_approved boolean default false,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ─────────────────────────────────────────────
-- WARD SUSTAININGS (per-ward tracking for stake callings)
-- ─────────────────────────────────────────────
create table ward_sustainings (
  id uuid default uuid_generate_v4() primary key,
  calling_id uuid references callings(id) on delete cascade not null,
  ward_id uuid references wards(id) on delete restrict not null,
  sustained boolean not null default false,
  sustained_at timestamptz,
  sustained_by uuid references profiles(id) on delete set null,
  unique (calling_id, ward_id)
);

-- ─────────────────────────────────────────────
-- CALLING LOG (append-only audit trail)
-- ─────────────────────────────────────────────
create table calling_log (
  id uuid default uuid_generate_v4() primary key,
  calling_id uuid references callings(id) on delete cascade not null,
  action text not null,
  from_stage text,
  to_stage text,
  performed_by uuid references profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table profiles enable row level security;
alter table wards enable row level security;
alter table callings enable row level security;
alter table ward_sustainings enable row level security;
alter table calling_log enable row level security;

create policy "profiles_select" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_admin_update" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.status = 'approved' and p.role in ('stake_president','stake_clerk','exec_secretary'))
);

create policy "wards_select" on wards for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);

create policy "callings_select" on callings for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "callings_insert" on callings for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved') and created_by = auth.uid()
);
create policy "callings_update" on callings for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);

create policy "ward_sustainings_select" on ward_sustainings for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "ward_sustainings_insert" on ward_sustainings for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "ward_sustainings_update" on ward_sustainings for update using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);

create policy "calling_log_select" on calling_log for select using (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved')
);
create policy "calling_log_insert" on calling_log for insert with check (
  exists (select 1 from profiles where id = auth.uid() and status = 'approved') and performed_by = auth.uid()
);

-- ─────────────────────────────────────────────
-- TRIGGER: Auto-create profile on signup
-- ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role, status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'stake_clerk'),
    'pending'
  ) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure handle_new_user();
