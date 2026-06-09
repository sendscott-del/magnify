-- Scope shared public.profiles by owning app to stop Magnify<->Sparkle cross-app leakage.
--
-- Background: Magnify and Sparkle Pro both write to the single, unprefixed
-- public.profiles table via handle_new_user(). The trigger already branched on
-- the signup's `app` metadata but discarded the label, and the Sparkle branch
-- left `status` at its 'pending' default. Result: Sparkle signups appeared in
-- Magnify's Pending Access queue (and Magnify Approve/Reject mutated Sparkle rows).
--
-- This migration adds an `app` column, stamps it in the trigger for both apps,
-- and backfills existing rows. Application queries are updated in parallel to
-- filter every profiles *list* read by app.
--
-- Idempotent: safe to re-run.

alter table public.profiles add column if not exists app text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app text := lower(coalesce(new.raw_user_meta_data->>'app', ''));
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'staff');
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
begin
  if v_app = 'magnify' then
    insert into profiles (id, email, full_name, role, status, app)
    values (new.id, coalesce(new.email, ''), v_name, v_role, 'pending', 'magnify')
    on conflict (id) do nothing;

  elsif v_app = 'squarecana' then
    insert into sq_users (id, email, full_name, status)
    values (new.id, coalesce(new.email, ''), v_name, 'pending')
    on conflict (id) do nothing;

  elsif v_app = 'sparkle' then
    insert into profiles (id, email, full_name, role, app)
    values (new.id, coalesce(new.email, ''), v_name, v_role, 'sparkle')
    on conflict (id) do nothing;
    if v_role = 'owner' then
      insert into business_settings (owner_id, business_name)
      values (new.id, 'Sparkle Pro')
      on conflict (owner_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

-- Backfill existing rows by role (church roles -> magnify, owner/staff -> sparkle).
update public.profiles set app = 'magnify'
 where app is null and role in ('stake_president','first_counselor','second_counselor','high_councilor','stake_clerk','exec_secretary');
update public.profiles set app = 'sparkle'
 where app is null and role in ('owner','staff');
