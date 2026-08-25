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
  calling_name: string;
  member_name: string;
  ward_idx: number;
  age_days: number;
  rejected?: boolean;
  /** Stake presidency member holding the interview (mp_ordination only). */
  interview_by?: string;
}

const SEEDS: DemoCallingSeed[] = [
  // Ideas
  { stage: 'ideas',         type: 'ward_calling',  calling_name: 'Sunday School Teacher',     member_name: 'Sister Andersen',  ward_idx: 0, age_days: 1 },
  { stage: 'ideas',         type: 'ward_calling',  calling_name: 'Primary 2nd Counselor',     member_name: 'Brother Park',     ward_idx: 1, age_days: 2 },
  { stage: 'ideas',         type: 'stake_calling', calling_name: 'Stake Music Director',      member_name: 'Sister Reyes',     ward_idx: 2, age_days: 3 },
  // For approval
  { stage: 'for_approval',  type: 'ward_calling',  calling_name: 'Young Men President',       member_name: 'Brother Tanaka',   ward_idx: 3, age_days: 4 },
  { stage: 'for_approval',  type: 'mp_ordination', calling_name: 'Ordain to Elder',           member_name: 'Brother Lopez',    ward_idx: 0, age_days: 5 },
  // Stake approved
  { stage: 'stake_approved', type: 'ward_calling', calling_name: 'Relief Society President',  member_name: 'Sister Olsen',     ward_idx: 4, age_days: 6 },
  { stage: 'stake_approved', type: 'stake_calling', calling_name: 'High Council (Missionary)', member_name: 'Brother Ng',     ward_idx: 2, age_days: 7 },
  // Pending interview (MP only)
  { stage: 'pending_interview', type: 'mp_ordination', calling_name: 'Ordain to Elder',      member_name: 'Brother Duarte',   ward_idx: 3, age_days: 7, interview_by: 'Brother Delgado' },
  // HC approval
  { stage: 'hc_approval',   type: 'mp_ordination', calling_name: 'Ordain to High Priest',     member_name: 'Brother Smith',    ward_idx: 1, age_days: 8 },
  // Issue calling / extend
  { stage: 'issue_calling', type: 'ward_calling',  calling_name: 'Bishopric 2nd Counselor',   member_name: 'Brother Kim',      ward_idx: 0, age_days: 10 },
  // Ordained (MP only — between issue_calling and sustain)
  { stage: 'ordained',      type: 'mp_ordination', calling_name: 'Ordain to Elder',           member_name: 'Brother Webb',     ward_idx: 4, age_days: 11 },
  // Sustain
  { stage: 'sustain',       type: 'ward_calling',  calling_name: 'Elders Quorum President',   member_name: 'Brother Patel',    ward_idx: 3, age_days: 12 },
  // Set apart
  { stage: 'set_apart',     type: 'ward_calling',  calling_name: 'Primary President',         member_name: 'Sister Hatchett',  ward_idx: 4, age_days: 14 },
  // Record
  { stage: 'record',        type: 'stake_calling', calling_name: 'Stake Audit Committee',     member_name: 'Brother Yamamoto', ward_idx: 2, age_days: 18 },
  // Complete
  { stage: 'complete',      type: 'ward_calling',  calling_name: 'Sunday School President',   member_name: 'Brother Brown',    ward_idx: 0, age_days: 35 },
  // One declined for the rejected list
  { stage: 'for_approval',  type: 'ward_calling',  calling_name: 'Activities Committee Chair', member_name: 'Brother Jensen',  ward_idx: 1, age_days: 20, rejected: true },
];

const DEMO_USER_ID = 'demo-00000000-0000-0000-0000-000000000001';

function makeCalling(seed: DemoCallingSeed, idx: number): Calling {
  const ward = WARDS[seed.ward_idx];
  return {
    id: `demo-call-${idx.toString().padStart(3, '0')}`,
    type: seed.type,
    stage: seed.stage,
    calling_name: seed.calling_name,
    ward_id: ward.id,
    member_name: seed.member_name,
    rejected: seed.rejected ?? false,
    rejection_notes: seed.rejected ? 'Conflicts with another calling' : undefined,
    bishop_approved: ['stake_approved', 'pending_interview', 'hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record', 'complete'].includes(seed.stage),
    interview_by: seed.interview_by ?? null,
    extend_by: null,
    sustain_by: null,
    set_apart_by: null,
    record_by: null,
    ordination_type: seed.type === 'mp_ordination' ? (seed.calling_name.includes('Elder') ? 'elder' : 'high_priest') : undefined,
    notes: undefined,
    created_by: DEMO_USER_ID,
    created_at: isoDaysAgo(seed.age_days),
    completed_at: seed.stage === 'complete' ? isoDaysAgo(seed.age_days - 30) : undefined,
    wards: ward as unknown as Calling['wards'],
  } as Calling;
}

const ALL = SEEDS.map((s, i) => makeCalling(s, i));

export function getDemoActiveCallings(): Calling[] {
  // Active = stage in ACTIVE_STAGES, not rejected.
  return ALL.filter(c => ['ideas', 'for_approval', 'pending_interview', 'stake_approved'].includes(c.stage) && !c.rejected);
}

export function getDemoHCCallings(): Calling[] {
  // Match the HC kanban query: all six HC stages.
  return ALL.filter(c => ['hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record'].includes(c.stage) && !c.rejected);
}

export function getDemoRejectedCallings(): Calling[] {
  return ALL.filter(c => c.rejected && c.stage !== 'complete');
}

export function getDemoCompletedCallings(): Calling[] {
  return ALL.filter(c => c.stage === 'complete');
}

export function getDemoAllCallings(): Calling[] {
  return ALL;
}
