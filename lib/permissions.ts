import { UserRole, Stage, CallingType } from './database.types';

export interface PermittedAction {
  canAdvance: boolean;
  nextStage: Stage | null;
  advanceLabel: string;
  canReject: boolean;
}

export const PRESIDENCY: UserRole[] = ['stake_president', 'first_counselor', 'second_counselor'];
export const ADMIN_GROUP: UserRole[] = ['stake_president', 'first_counselor', 'second_counselor', 'stake_clerk', 'exec_secretary'];
export const ALL_APPROVED: UserRole[] = ['stake_president', 'first_counselor', 'second_counselor', 'high_councilor', 'stake_clerk', 'exec_secretary'];

/** Context needed for conditional advance permissions */
export interface AdvanceContext {
  /** All 3 required SP members (president, 1st, 2nd counselor) have approved */
  spAllApproved: boolean;
  /** More than 50% of active HC members have approved */
  hcThresholdMet: boolean;
  /** Current user is the person assigned for this stage's task */
  isAssignedUser: boolean;
}

/**
 * Determines whether the advance button should be VISIBLE for this user.
 *
 * SP Board rules:
 *   ideas → for_approval:        Only Stake President
 *   for_approval → stake_approved: SP only before all 3 approved; ADMIN_GROUP after all 3
 *   stake_approved → hc_approval: Any user
 *   stake_approved → pending_interview: MP ordinations only — any user
 *   pending_interview → hc_approval: ADMIN_GROUP (the presidency does the interview)
 *
 * HC Board rules:
 *   hc_approval → extend/sustain: SP only before >50% HC; ADMIN_GROUP after >50%. HC never.
 *   issue_calling → sustain:      ADMIN_GROUP or assigned extend_by user
 *   sustain → set_apart:          ADMIN_GROUP or assigned sustain_by user
 *   set_apart → record:           ADMIN_GROUP or assigned set_apart_by user
 *   record → complete:            ADMIN_GROUP only
 *
 * Releases (isRelease) short-circuit the pipeline: for_approval → sustain →
 * complete. Leaving for_approval is the Stake President's click alone — the
 * all-3-approved path never applies to a release.
 */
export function canAdvanceStage(role: UserRole, stage: Stage, _type: CallingType, ctx?: AdvanceContext, isRelease = false): boolean {
  if (isRelease && stage === 'for_approval') {
    return role === 'stake_president';
  }
  switch (stage) {
    case 'ideas':
      // Only the Stake President can move from Ideas to For Approval
      return role === 'stake_president';

    case 'for_approval':
      // Stake President can always advance
      if (role === 'stake_president') return true;
      // Others only see the button after all 3 SP have approved
      return ctx?.spAllApproved === true && ADMIN_GROUP.includes(role);

    case 'stake_approved':
      // Any user can move from Stake Approved onward (to HC Approval, or to
      // Pending Interview for an MP ordination)
      return ALL_APPROVED.includes(role);

    case 'pending_interview':
      // The stake presidency conducts the interview. Clerk and exec secretary
      // are included because they schedule them and often record the outcome;
      // high councilors are not — the card hasn't reached them yet.
      return ADMIN_GROUP.includes(role);

    case 'hc_approval':
      // High councilors NEVER see the advance button
      if (role === 'high_councilor') return false;
      // Stake President can always advance
      if (role === 'stake_president') return true;
      // Others only after >50% HC have approved
      return ctx?.hcThresholdMet === true && ADMIN_GROUP.includes(role);

    case 'issue_calling':
    case 'ordained':
      // ADMIN_GROUP or the assigned extend_by user
      return ADMIN_GROUP.includes(role) || ctx?.isAssignedUser === true;

    case 'sustain':
      // ADMIN_GROUP or the assigned sustain_by user
      return ADMIN_GROUP.includes(role) || ctx?.isAssignedUser === true;

    case 'set_apart':
      // ADMIN_GROUP or the assigned set_apart_by user
      return ADMIN_GROUP.includes(role) || ctx?.isAssignedUser === true;

    case 'record':
      // Only ADMIN_GROUP (stake presidency + clerk + exec secretary)
      return ADMIN_GROUP.includes(role);

    default:
      return false;
  }
}

// All users can decline a calling (except at ideas or complete stage)
export function canReject(role: UserRole, stage: Stage): boolean {
  if (stage === 'ideas' || stage === 'complete') return false;
  return ALL_APPROVED.includes(role);
}

export function canMoveback(role: UserRole): boolean {
  return ADMIN_GROUP.includes(role);
}

export function canDelete(role: UserRole): boolean {
  return ADMIN_GROUP.includes(role);
}

export function getNextStage(stage: Stage, type: CallingType, isRelease = false): Stage | null {
  if (isRelease) {
    // Announcement-only: approve → announce (sustain) → done.
    switch (stage) {
      case 'for_approval': return 'sustain';
      case 'sustain': return 'complete';
      default: return null;
    }
  }
  const isMP = type === 'mp_ordination';
  switch (stage) {
    case 'ideas': return 'for_approval';
    case 'for_approval': return 'stake_approved';
    // MP ordinations detour through the presidency's interview queue. Every
    // other type goes straight to the high council, as it always has.
    case 'stake_approved': return isMP ? 'pending_interview' : 'hc_approval';
    case 'pending_interview': return 'hc_approval';
    case 'hc_approval': return isMP ? 'sustain' : 'issue_calling';
    case 'issue_calling': return 'sustain';
    case 'ordained': return 'sustain'; // legacy stage
    case 'sustain': return 'set_apart';
    case 'set_apart': return 'record';
    case 'record': return 'complete';
    default: return null;
  }
}

export function getPrevStage(stage: Stage, type: CallingType, isRelease = false): Stage | null {
  if (isRelease) {
    switch (stage) {
      case 'sustain': return 'for_approval';
      case 'complete': return 'sustain';
      default: return null;
    }
  }
  const isMP = type === 'mp_ordination';
  switch (stage) {
    case 'for_approval': return 'ideas';
    case 'stake_approved': return 'for_approval';
    case 'pending_interview': return 'stake_approved';
    case 'hc_approval': return isMP ? 'pending_interview' : 'stake_approved';
    case 'issue_calling': return 'hc_approval';
    case 'ordained': return 'hc_approval';
    case 'sustain': return isMP ? 'hc_approval' : 'issue_calling';
    case 'set_apart': return 'sustain';
    case 'record': return 'set_apart';
    case 'complete': return 'record';
    default: return null;
  }
}

export function getAdvanceLabel(stage: Stage, type: CallingType, isRelease = false): string {
  if (isRelease) {
    switch (stage) {
      case 'for_approval': return 'Approve Release → Sustain';
      case 'sustain': return 'Announced — Complete';
      default: return 'Advance';
    }
  }
  switch (stage) {
    case 'ideas': return 'Submit for Approval';
    case 'for_approval': return 'Stake Presidency Approves';
    case 'stake_approved': return type === 'mp_ordination' ? 'Send to Interview' : 'Send to High Council';
    case 'pending_interview': return 'Interview Complete → High Council';
    case 'hc_approval': return 'Mark Approved';
    case 'issue_calling': return 'Ready to Sustain';
    case 'ordained': return 'Ready to Sustain';
    case 'sustain': return 'Ready to Set Apart / Ordain';
    case 'set_apart': return 'Ready to Record';
    case 'record': return 'Complete';
    default: return 'Advance';
  }
}
