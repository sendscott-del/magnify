import type { ReferenceData, WeekBundle } from './scheduleData';

/**
 * Demo fixtures for the Sunday schedule. Invented buildings, wards and
 * companion; the same shapes as the live tables. The demo Sunday carries one
 * deliberate conflict (two 10:00 sacrament meetings) so the card's conflict
 * callout is visible to a trainer.
 */

const B_OFFICES = 'demo-b-offices';
const B_NORTH = 'demo-b-north';
const B_SOUTH = 'demo-b-south';

const W1 = 'demo-w-1';
const W2 = 'demo-w-2';
const W3 = 'demo-w-3';

const reference: ReferenceData = {
  buildings: [
    { id: B_OFFICES, name: 'Stake center', short_name: 'Stake center', address: '100 Main St' },
    { id: B_NORTH, name: 'North building', short_name: 'North', address: '200 North Ave' },
    { id: B_SOUTH, name: 'South building', short_name: 'South', address: '300 South Ave' },
  ],
  wardTimes: [
    { ward_id: W1, building_id: B_NORTH, sacrament_at: '10:00', duration_min: 70 },
    { ward_id: W2, building_id: B_SOUTH, sacrament_at: '10:00', duration_min: 70 },
    { ward_id: W3, building_id: B_OFFICES, sacrament_at: '11:30', duration_min: 70 },
  ],
  travel: [
    { from_building_id: B_OFFICES, to_building_id: B_NORTH, minutes: 25 },
    { from_building_id: B_OFFICES, to_building_id: B_SOUTH, minutes: 35 },
    { from_building_id: B_NORTH, to_building_id: B_SOUTH, minutes: 30 },
    { from_building_id: B_NORTH, to_building_id: B_OFFICES, minutes: 25 },
    { from_building_id: B_SOUTH, to_building_id: B_NORTH, minutes: 30 },
    { from_building_id: B_SOUTH, to_building_id: B_OFFICES, minutes: 35 },
  ],
  settings: { offices_building_id: B_OFFICES },
  wards: [
    { id: W1, name: 'Riverside', abbreviation: 'RV' },
    { id: W2, name: 'Lakeview', abbreviation: 'LV' },
    { id: W3, name: 'Maple 2nd', abbreviation: 'MP2' },
  ],
  hcMembers: [
    { id: 'demo-hc-1', name: 'Br. Whitfield', user_id: null },
    { id: 'demo-hc-2', name: 'Br. Oduya', user_id: null },
  ],
};

function bundle(sundayISO: string): WeekBundle {
  const weekId = 'demo-week';
  return {
    week: { id: weekId, sunday_on: sundayISO, kind: 'meetings', holiday_label: null },
    meetings: [
      { id: 'demo-m-1', week_id: weekId, body: 'SC', starts_at: '07:30', ends_at: '08:30', format: 'in_person', label: null, sort_order: 1 },
      { id: 'demo-m-2', week_id: weekId, body: 'SP_RS', starts_at: '08:30', ends_at: '09:00', format: 'in_person', label: null, sort_order: 2 },
    ],
    assignments: [
      { week_id: weekId, seat: 'P', ward_id: W1 },
      { week_id: weekId, seat: 'P', ward_id: W2 },
      { week_id: weekId, seat: '1C', ward_id: W3 },
    ],
    rotation: { week_id: weekId, hc_member_id: 'demo-hc-1', reason: 'his own ward is Riverside', member_name: 'Br. Whitfield' },
    reminders: [],
    note: '',
  };
}

export const DEMO_SUNDAY = { reference, bundle };
