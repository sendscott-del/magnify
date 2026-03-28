import { UserRole, Stage, CallingType } from './database.types';

export interface PermittedAction {
  canAdvance: boolean;
  nextStage: Stage | null;
  advanceLabel: string;
  canReject: boolean;
}

const PRESIDENCY: UserRole[] = ['stake_president', 'first_counselor', 'second_counselor'];
const CLERK_GROUP: UserRole[] = ['stake_president', 'stake_clerk'];
const HC: UserRole[] = ['high_councilor'];
const RECORD_GROUP: UserRole[] = ['stake_president', 'stake_clerk', 'exec_secretary'];
const ALL_APPROVED: UserRole[] = ['stake_president', 'first_counselor', 'second_counselor', 'high_councilor', 'stake_clerk', 'exec_secretary'];

export function canAdvanceStage(role: UserRole, stage: Stage, type: CallingType): boolean {
  switch (stage) {
    case 'ideas': return ALL_APPROVED.includes(role);
    case 'for_approval': return PRESIDENCY.includes(role);
    case 'stake_approved': return CLERK_GROUP.includes(role);
    case 'hc_approval': return HC.includes(role) || CLERK_GROUP.includes(role);
    case 'issue_calling': return HC.includes(role) || CLERK_GROUP.includes(role);
    case 'ordained': return HC.includes(role) || CLERK_GROUP.includes(role);
    case 'sustain': return HC.includes(role) || CLERK_GROUP.includes(role);
    case 'set_apart': return HC.includes(role) || CLERK_GROUP.includes(role);
    case 'record': return RECORD_GROUP.includes(role);
    default: return false;
  }
}

export function canReject(role: UserRole, stage: Stage): boolean {
  if (stage === 'ideas' || stage === 'for_approval' || stage === 'complete') return false;
  return PRESIDENCY.includes(role) || CLERK_GROUP.includes(role);
}

export function getNextStage(stage: Stage, type: CallingType): Stage | null {
  switch (stage) {
    case 'ideas': return 'for_approval';
    case 'for_approval': return 'stake_approved';
    case 'stake_approved': return 'hc_approval';
    case 'hc_approval': return type === 'mp_ordination' ? 'ordained' : 'issue_calling';
    case 'issue_calling': return 'sustain';
    case 'ordained': return 'record';
    case 'sustain': return type === 'mp_ordination' ? 'record' : 'set_apart';
    case 'set_apart': return 'record';
    case 'record': return 'complete';
    default: return null;
  }
}

export function getAdvanceLabel(stage: Stage, type: CallingType): string {
  switch (stage) {
    case 'ideas': return 'Submit for Approval';
    case 'for_approval': return 'Stake Presidency Approves';
    case 'stake_approved': return 'Send to High Council';
    case 'hc_approval': return type === 'mp_ordination' ? 'Mark Ordained' : 'Issue Calling';
    case 'issue_calling': return 'Mark Sustained';
    case 'ordained': return 'Mark Recorded';
    case 'sustain': return type === 'mp_ordination' ? 'Mark Recorded' : 'Mark Set Apart';
    case 'set_apart': return 'Mark Recorded';
    case 'record': return 'Mark Complete';
    default: return 'Advance';
  }
}
