-- Migration 006: Add release member fields to callings
-- These fields capture the person who currently holds a calling and needs to be released
-- when the new calling is extended.

alter table callings add column if not exists release_member_name text;
alter table callings add column if not exists release_current_calling text;
alter table callings add column if not exists release_ward_id uuid;
