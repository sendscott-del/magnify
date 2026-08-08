-- Native push tokens (Expo Push API) for the iOS/Android store builds.
-- Web/PWA push keeps using magnify_push_subscriptions; this is the native
-- twin, consumed by the magnify-send-action-pushes edge function.

create table if not exists magnify_native_push_tokens (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  token          text not null unique,
  platform       text not null check (platform in ('ios','android')),
  last_count     int not null default 0,
  last_pushed_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_magnify_native_push_user on magnify_native_push_tokens(user_id);

alter table magnify_native_push_tokens enable row level security;

drop policy if exists "native_push_select_own" on magnify_native_push_tokens;
create policy "native_push_select_own" on magnify_native_push_tokens for select using (user_id = auth.uid());
drop policy if exists "native_push_insert_own" on magnify_native_push_tokens;
create policy "native_push_insert_own" on magnify_native_push_tokens for insert with check (user_id = auth.uid());
drop policy if exists "native_push_update_own" on magnify_native_push_tokens;
create policy "native_push_update_own" on magnify_native_push_tokens for update using (user_id = auth.uid());
drop policy if exists "native_push_delete_own" on magnify_native_push_tokens;
create policy "native_push_delete_own" on magnify_native_push_tokens for delete using (user_id = auth.uid());
