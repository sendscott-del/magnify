-- A schedule meeting can name the building it is held in.
--
-- Until now buildTimeline() hardcoded EVERY in-person meeting to the stake
-- offices:
--
--     buildingId: zoom ? null : officesId
--
-- That is right for SP, HC, SC and the rest, which do meet at the offices.
-- It is wrong for a TRAINING held in a ward building. On 2026-09-20 the
-- schedule carried "Hyde Park Bishopric" 11:00-11:30, and the president's
-- Hyde Park 1st sacrament starts at 11:30 in the Hyde Park building. The
-- timeline placed the training at Pulaski, found the 22-minute Pulaski ->
-- Hyde Park drive, and raised a conflict no human would recognise: "the gap
-- before Hyde Park 1st sacrament is 0 mins". The training was already in the
-- building. There was simply no way to say so.
--
-- NULL keeps today's meaning — the stake offices — so every existing row and
-- every future SP/HC/SC meeting behaves exactly as before. Only a meeting
-- that is somewhere else needs to say where.
--
-- ON DELETE SET NULL, not CASCADE: retiring a building must never delete a
-- Sunday's meetings. It falls back to the offices, which is the old default.

alter table magnify_schedule_meetings
  add column if not exists building_id uuid
    references magnify_buildings(id) on delete set null;

comment on column magnify_schedule_meetings.building_id is
  'Where this meeting is held. NULL = the stake offices (magnify_stake_settings.offices_building_id).';

-- No RLS change. magnify_meetings_select / _write gate on stake and role, not
-- on which columns a row carries.
