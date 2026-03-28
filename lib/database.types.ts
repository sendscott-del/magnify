export type UserRole = 'stake_president' | 'first_counselor' | 'second_counselor' | 'high_councilor' | 'stake_clerk' | 'exec_secretary';
export type ProfileStatus = 'pending' | 'approved' | 'rejected';
export type CallingType = 'ward_calling' | 'stake_calling' | 'mp_ordination';
export type Stage = 'ideas' | 'for_approval' | 'stake_approved' | 'hc_approval' | 'issue_calling' | 'ordained' | 'sustain' | 'set_apart' | 'record' | 'complete';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: ProfileStatus;
  created_at: string;
}

export interface Ward {
  id: string;
  name: string;
  abbreviation: string;
  sort_order: number;
}

export interface Calling {
  id: string;
  type: CallingType;
  member_name: string;
  calling_name: string;
  ordination_type?: 'elder' | 'high_priest';
  ward_id: string;
  stage: Stage;
  rejected: boolean;
  rejection_notes?: string;
  org_recommended?: boolean;
  bishop_approved?: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  completed_at?: string;
  wards?: Ward;
  profiles?: Profile;
}

export interface WardSustaining {
  id: string;
  calling_id: string;
  ward_id: string;
  sustained: boolean;
  sustained_at?: string;
  sustained_by?: string;
  wards?: Ward;
  profiles?: Profile;
}

export interface CallingLogEntry {
  id: string;
  calling_id: string;
  action: string;
  from_stage?: Stage;
  to_stage?: Stage;
  performed_by?: string;
  notes?: string;
  created_at: string;
  profiles?: Profile;
}
