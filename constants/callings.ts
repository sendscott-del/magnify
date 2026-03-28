export type UserRole = 'stake_president' | 'first_counselor' | 'second_counselor' | 'high_councilor' | 'stake_clerk' | 'exec_secretary';
export type CallingType = 'ward_calling' | 'stake_calling' | 'mp_ordination';
export type Stage = 'ideas' | 'for_approval' | 'stake_approved' | 'hc_approval' | 'issue_calling' | 'ordained' | 'sustain' | 'set_apart' | 'record' | 'complete';

export const STAGE_LABELS: Record<Stage, string> = {
  ideas: 'Ideas',
  for_approval: 'For Approval',
  stake_approved: 'Stake Approved',
  hc_approval: 'HC Approval',
  issue_calling: 'Issue Calling',
  ordained: 'Ordained',
  sustain: 'Sustain',
  set_apart: 'Set Apart',
  record: 'Record',
  complete: 'Complete',
};

export const WARDS = [
  { name: 'Westchester 1st', abbreviation: 'WC1' },
  { name: 'Westchester 2nd', abbreviation: 'WC2' },
  { name: 'Hyde Park 1st', abbreviation: 'HP1' },
  { name: 'Hyde Park 2nd', abbreviation: 'HP2' },
  { name: 'Hyde Park 3rd', abbreviation: 'HP3' },
  { name: 'Blue Island', abbreviation: 'BI' },
  { name: 'Moraine Valley', abbreviation: 'MV' },
  { name: 'Midway', abbreviation: 'MW' },
  { name: 'Chicago 2nd', abbreviation: 'CH2' },
];

// Only callings requiring Stake Presidency + High Council approval per the Church Handbook
export const CALLING_GROUPS: { org: string; callings: string[] }[] = [
  {
    org: 'Bishopric',
    callings: [
      'First Counselor in Bishopric',
      'Second Counselor in Bishopric',
      'Ward Clerk',
      'Assistant Ward Clerk',
      'Ward Executive Secretary',
      'Assistant Ward Executive Secretary',
    ],
  },
  {
    org: 'Elders Quorum',
    callings: [
      'Elders Quorum President',
    ],
  },
  {
    org: 'Relief Society',
    callings: [
      'Relief Society President',
    ],
  },
  {
    org: 'Young Women',
    callings: [
      'Young Women President',
    ],
  },
  {
    org: 'Young Men',
    callings: [
      'Young Men President',
    ],
  },
  {
    org: 'Sunday School',
    callings: [
      'Sunday School President',
    ],
  },
  {
    org: 'Primary',
    callings: [
      'Primary President',
    ],
  },
  {
    org: 'Stake',
    callings: [
      'High Councilor',
      'Stake Executive Secretary',
      'Stake Clerk',
      'Assistant Stake Clerk',
      'Stake Patriarch',
      'Stake Relief Society President',
      'First Counselor in Stake Relief Society',
      'Second Counselor in Stake Relief Society',
      'Stake Young Women President',
      'First Counselor in Stake Young Women',
      'Second Counselor in Stake Young Women',
      'Stake Primary President',
      'First Counselor in Stake Primary',
      'Second Counselor in Stake Primary',
      'Stake Young Men President',
      'Stake Sunday School President',
      'Stake Auditor',
    ],
  },
  { org: 'Other', callings: [] },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  stake_president: 'Stake President',
  first_counselor: 'First Counselor',
  second_counselor: 'Second Counselor',
  high_councilor: 'High Councilor',
  stake_clerk: 'Stake Clerk',
  exec_secretary: 'Executive Secretary',
};
