import type { Calling } from './database.types';

// Demo fixtures for Magnify — fake callings across the workflow stages
// so trainers can talk through the kanban without exposing real ward
// callings. Same shape as the live `callings` table joined with `wards`.

function isoDaysAgo(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return t.toISOString();
}

const WARDS = [
  { id: 'demo-ward-1', name: 'Hyde Park 1st', abbreviation: 'HP1' },
  { id: 'demo-ward-2', name: 'Hyde Park 2nd', abbreviation: 'HP2' },
  { id: 'demo-ward-3', name: 'Midway',         abbreviation: 'MW'  },
  { id: 'demo-ward-4', name: 'Chicago 2nd',    abbreviation: 'CH2' },
  { id: 'demo-ward-5', name: 'Wilmette 2nd',   abbreviation: 'WC2' },
];

interface DemoCallingSeed {
  stage: string;
  type: 'ward_calling' | 'stake_calling' | 'mp_ordination';
  name: string;
  member_name: string;
  ward_idx: number;
  age_days: number;
  rejected?: boolean;
}

const SEEDS: DemoCallingSeed[] = [
  // Ideas
  { stage: 'ideas',         type: 'ward_calling',  name: 'Sunday School Teacher',     member_name: 'Sister Andersen',  ward_idx: 0, age_days: 1 },
  { stage: 'ideas',         type: 'ward_calling',  name: 'Primary 2nd Counselor',     member_name: 'Brother Park',     ward_idx: 1, age_days: 2 },
  { stage: 'ideas',         type: 'stake_calling', name: 'Stake Music Director',      member_name: 'Sister Reyes',     ward_idx: 2, age_days: 3 },
  // For approval
  { stage: 'for_approval',  type: 'ward_calling',  name: 'Young Men President',       member_name: 'Brother Tanaka',   ward_idx: 3, age_days: 4 },
  { stage: 'for_approval',  type: 'mp_ordination', name: 'Ordain to Elder',           member_name: 'Brother Lopez',    ward_idx: 0, age_days: 5 },
  // Stake approved
  { stage: 'stake_approved', type: 'ward_calling', name: 'Relief Society President',  member_name: 'Sister Olsen',     ward_idx: 4, age_days: 6 },
  { stage: 'stake_approved', type: 'stake_calling', name: 'High Council (Missionary)', member_name: 'Brother Ng',     ward_idx: 2, age_days: 7 },
  // HC approval
  { stage: 'hc_approval',   type: 'mp_ordination', name: 'Ordain to High Priest',     member_name: 'Brother Smith',    ward_idx: 1, age_days: 8 },
  // Issue calling / extend
  { stage: 'issue_calling', type: 'ward_calling',  name: 'Bishopric 2nd Counselor',   member_name: 'Brother Kim',      ward_idx: 0, age_days: 10 },
  // Sustain
  { stage: 'sustain',       type: 'ward_calling',  name: 'Elders Quorum President',   member_name: 'Brother Patel',    ward_idx: 3, age_days: 12 },
  // Set apart
  { stage: 'set_apart',     type: 'ward_calling',  name: 'Primary President',         member_name: 'Sister Hatchett',  ward_idx: 4, age_days: 14 },
  // Record
  { stage: 'record',        type: 'stake_calling', name: 'Stake Audit Committee',     member_name: 'Brother Yamamoto', ward_idx: 2, age_days: 18 },
  // Complete
  { stage: 'complete',      type: 'ward_calling',  name: 'Sunday School President',   member_name: 'Brother Brown',    ward_idx: 0, age_days: 35 },
  // One declined for the rejected list
  { stage: 'for_approval',  type: 'ward_calling',  name: 'Activities Committee Chair', member_name: 'Brother Jensen',  ward_idx: 1, age_days: 20, rejected: true },
];

const DEMO_USER_ID = 'demo-00000000-0000-0000-0000-000000000001';

function makeCalling(seed: DemoCallingSeed, idx: number): Calling {
  const ward = WARDS[seed.ward_idx];
  return {
    id: `demo-call-${idx.toString().padStart(3, '0')}`,
    type: seed.type,
    stage: seed.stage,
    name: seed.name,
    ward_id: ward.id,
    member_name: seed.member_name,
    member_id: null,
    rejected: seed.rejected ?? false,
    rejected_reason: seed.rejected ? 'Conflicts with another calling' : null,
    bishop_approved: ['stake_approved', 'hc_approval', 'issue_calling', 'sustain', 'set_apart', 'record', 'complete'].includes(seed.stage),
    sustain_date: ['set_apart', 'record', 'complete'].includes(seed.stage) ? isoDaysAgo(seed.age_days - 7) : null,
    set_apart_date: ['record', 'complete'].includes(seed.stage) ? isoDaysAgo(seed.age_days - 10) : null,
    extended_by: null,
    set_apart_by: null,
    ordination_type: seed.type === 'mp_ordination' ? (seed.name.includes('Elder') ? 'elder' : 'high_priest') : null,
    notes: null,
    created_by: DEMO_USER_ID,
    created_at: isoDaysAgo(seed.age_days),
    updated_at: isoDaysAgo(seed.age_days),
    wards: ward,
  } as unknown as Calling;
}

const ALL = SEEDS.map((s, i) => makeCalling(s, i));

export function getDemoActiveCallings(): Calling[] {
  // Active = stage in ACTIVE_STAGES, not rejected.
  return ALL.filter(c => ['ideas', 'for_approval', 'stake_approved'].includes((c as unknown as { stage: string }).stage) && !(c as unknown as { rejected: boolean }).rejected);
}

export function getDemoHCCallings(): Calling[] {
  return ALL.filter(c => ['hc_approval', 'issue_calling', 'sustain', 'set_apart'].includes((c as unknown as { stage: string }).stage));
}

export function getDemoRejectedCallings(): Calling[] {
  return ALL.filter(c => (c as unknown as { rejected: boolean }).rejected && (c as unknown as { stage: string }).stage !== 'complete');
}

export function getDemoCompletedCallings(): Calling[] {
  return ALL.filter(c => ['record', 'complete'].includes((c as unknown as { stage: string }).stage));
}

export function getDemoAllCallings(): Calling[] {
  return ALL;
}
