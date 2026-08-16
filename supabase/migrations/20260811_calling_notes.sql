-- Append-only per-calling notes ("comments"): any approved user in the stake —
-- high councilors included — can ADD a note, stamped with their name and time.
-- Nobody overwrites anyone else's. This is separate from callings.notes (the
-- single admin-editable field), which is unchanged. Requested by Miguel
-- Gutierrez 2026-08-11: high councilors should be able to put in notes.

create table if not exists calling_notes (
  id          uuid primary key default gen_random_uuid(),
  calling_id  uuid not null references callings(id) on delete cascade,
  stake_id    uuid not null default current_user_stake_single() references stakes(id),
  author_id   uuid references profiles(id) on delete set null,
  author_name text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_calling_notes_calling on calling_notes(calling_id, created_at);

alter table calling_notes enable row level security;

-- Same-stake, approved Magnify users read the thread.
drop policy if exists "calling_notes_select" on calling_notes;
create policy "calling_notes_select" on calling_notes for select using (
  stake_id in (select current_user_stake())
  and exists (select 1 from profiles where id = auth.uid() and app = 'magnify' and status = 'approved')
);

-- Add a note: same stake, approved, and you can only post as yourself.
drop policy if exists "calling_notes_insert" on calling_notes;
create policy "calling_notes_insert" on calling_notes for insert with check (
  stake_id in (select current_user_stake())
  and author_id = auth.uid()
  and exists (select 1 from profiles where id = auth.uid() and app = 'magnify' and status = 'approved')
);

-- You may remove your own note (fix a typo / mistaken post). No editing others'.
drop policy if exists "calling_notes_delete_own" on calling_notes;
create policy "calling_notes_delete_own" on calling_notes for delete using (
  author_id = auth.uid()
);

-- Demo account never writes real data (mirrors the other demo_block_* guards).
drop policy if exists "demo_block_all" on calling_notes;
create policy "demo_block_all" on calling_notes as restrictive for all
  using (not is_demo_user()) with check (not is_demo_user());
