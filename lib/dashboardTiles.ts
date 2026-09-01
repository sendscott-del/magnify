import { TranslationKey } from '../constants/translations';
import { TileSpec, WorkstreamSpec } from '../components/dashboard/cards';
import {
  DashInterview, DashboardItem, StandardWorkRow, Workstream,
  byDueDate, daysUntil, formatMonthDay,
} from './dashboard';
import { WardRef } from './useDashboardData';

type T = (key: TranslationKey) => string;
type Lang = 'en' | 'es';

export type Scope = 'mine' | 'everyone';

/** Drill targets. `standard` MUST route to the standard-work screen — a
 *  recurring duty is not an interview, and conflating them was a specific
 *  correction during design review. */
export type DrillKey =
  | 'recommend' | 'audit' | 'interview' | 'assignment' | 'directive'
  | 'standard' | 'myInterview'
  | `ws:${string}`;

export const OPEN_STATUSES: DashboardItem['status'][] = ['open', 'in_progress', 'blocked'];

export function isOpen(item: DashboardItem): boolean {
  return OPEN_STATUSES.includes(item.status);
}

/**
 * "Mine" matches on the account link OR the display label. Most leaders in a
 * stake don't have a Magnify account, so owner_label carries a large share of
 * the ownership and an account-only match would show the stake president an
 * empty board.
 */
export function isMine(item: DashboardItem, myId: string | null, myName: string | null): boolean {
  if (myId && item.owner_user_id === myId) return true;
  if (myName && item.owner_label && item.owner_label === myName) return true;
  return false;
}

export function scopeItems(
  items: DashboardItem[], scope: Scope, myId: string | null, myName: string | null,
): DashboardItem[] {
  return scope === 'mine' ? items.filter(i => isMine(i, myId, myName)) : items;
}

function countOverdue(items: DashboardItem[]): number {
  return items.filter(i => { const d = daysUntil(i.due_on); return d !== null && d < 0; }).length;
}

function oldestOverdueDays(items: DashboardItem[]): number | null {
  const days = items
    .map(i => daysUntil(i.due_on))
    .filter((d): d is number => d !== null && d < 0)
    .map(Math.abs);
  return days.length ? Math.max(...days) : null;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

function lateFlag(items: DashboardItem[], t: T): TileSpec['flag'] {
  const n = countOverdue(items);
  return n > 0 ? { label: `${n} ${t('dash.flag.late')}`, tone: 'late' } : undefined;
}

function syncedFlag(items: DashboardItem[]): TileSpec['flag'] {
  return items.some(i => i.source === 'lcr_sync') ? { label: 'LCR', tone: 'neutral' } : undefined;
}

interface TileInput {
  openItems: DashboardItem[];
  interviews: DashInterview[];
  standardWork: StandardWorkRow[];
  callingStageCounts: Record<string, number>;
  wards: WardRef[];
  wardCount: number;
  myId: string | null;
  myName: string | null;
  hcVoteCount: number;
  t: T;
  language: Lang;
}

/**
 * Zone 2 for the presidency. Six tiles, each answering how many, by when,
 * whose. The callings tile is derived from the `callings` table rather than
 * magnify_items — the dashboard reports on the kanban, it doesn't duplicate it.
 */
export function presidencyTiles(input: TileInput): TileSpec[] {
  const { openItems, interviews, callingStageCounts, wards, wardCount, myId, myName, t, language } = input;

  const recommends = openItems.filter(i => i.kind === 'recommend');
  const audits = openItems.filter(i => i.kind === 'audit');
  const assignments = openItems.filter(i => i.kind === 'assignment');
  const directives = openItems.filter(i => i.kind === 'directive');

  // Recommends
  const oldest = oldestOverdueDays(recommends);
  const mineCount = recommends.filter(i => isMine(i, myId, myName)).length;

  // Audits — the count that matters is wards, not rows. Fall back to row count
  // when audit items carry no ward link yet.
  const auditWardIds = new Set(audits.map(a => a.ward_id).filter(Boolean) as string[]);
  const auditWardCount = auditWardIds.size || audits.length;
  const auditWardNames = wards
    .filter(w => auditWardIds.has(w.id))
    .map(w => w.abbreviation)
    .slice(0, 4)
    .join(', ');
  const auditDeadline = [...audits].sort(byDueDate)[0]?.due_on;

  // Callings — sum the live kanban stages. The breakdown shows the four
  // biggest buckets rather than a fixed list of stages: the board has gained
  // stages before (there are rows in `pending_interview` today), and a
  // hardcoded list silently hides whichever column is actually busiest.
  const callingTotal = Object.values(callingStageCounts).reduce((a, b) => a + b, 0);
  const stageSub = Object.entries(callingStageCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([stage, n]) => {
      const label = t(`stage.${stage}` as TranslationKey);
      // t() returns the key itself when there's no translation — fall back to
      // a readable form rather than printing "stage.pending_interview".
      const clean = label.startsWith('stage.') ? stage.replace(/_/g, ' ') : label;
      return `${clean} ${n}`;
    })
    .join(' · ');

  // Quarterly interviews
  const interviewsDone = interviews.filter(i => !!i.completed_at).length;
  const unassigned = interviews.filter(i => !i.assigned_to_user_id && !i.assignee_name).length;

  const assignmentOwners = new Set(
    assignments.map(a => a.owner_label ?? a.owner_user_id).filter(Boolean) as string[],
  ).size;

  const oldestDirective = [...directives]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  return [
    {
      key: 'recommend',
      kind: 'recommend',
      value: String(recommends.length),
      unit: t('dash.unit.interviews'),
      label: t('dash.tile.recommends'),
      sub: joinParts([
        oldest !== null ? `${t('dash.sub.oldestOverdue')} ${oldest} ${t('dash.due.days')}` : null,
        mineCount ? `${mineCount} ${t('dash.sub.areMine')}` : null,
      ]) || t('dash.sub.noneOutstanding'),
      flag: syncedFlag(recommends),
      drill: 'recommend',
    },
    {
      key: 'audit',
      kind: 'audit',
      value: String(auditWardCount),
      unit: `${t('dash.unit.of')} ${wardCount} ${t('dash.unit.wards')}`,
      label: t('dash.tile.audits'),
      sub: joinParts([
        auditDeadline ? `${t('dash.sub.deadline')} ${formatMonthDay(auditDeadline, language)}` : null,
        auditWardNames || null,
      ]) || t('dash.sub.noneOutstanding'),
      flag: lateFlag(audits, t),
      drill: 'audit',
    },
    {
      key: 'calling',
      kind: 'calling',
      value: String(callingTotal),
      unit: t('dash.unit.inFlight'),
      label: t('dash.tile.callings'),
      sub: stageSub || t('dash.sub.boardClear'),
      // No drill key: this tile opens the kanban board that owns the data.
    },
    {
      key: 'interview',
      kind: 'interview',
      value: `${interviewsDone} ${t('dash.unit.of')} ${interviews.length}`,
      unit: t('dash.unit.done'),
      label: t('dash.tile.interviews'),
      sub: joinParts([
        t('dash.sub.oneOnOnes'),
        unassigned ? `${unassigned} ${t('dash.sub.unassigned')}` : null,
      ]),
      drill: 'interview',
    },
    {
      key: 'assignment',
      kind: 'assignment',
      value: String(assignments.length),
      unit: t('dash.unit.open'),
      label: t('dash.tile.assignments'),
      sub: joinParts([
        assignmentOwners ? `${t('dash.sub.across')} ${assignmentOwners} ${t('dash.sub.leaders')}` : null,
      ]) || t('dash.sub.noneOutstanding'),
      flag: lateFlag(assignments, t),
      drill: 'assignment',
    },
    {
      key: 'directive',
      kind: 'directive',
      value: String(directives.length),
      unit: t('dash.unit.awaiting'),
      label: t('dash.tile.directives'),
      sub: oldestDirective
        ? `${t('dash.sub.oldestReceived')} ${formatMonthDay(oldestDirective.created_at.slice(0, 10), language)}`
        : t('dash.sub.noneOutstanding'),
      drill: 'directive',
    },
  ];
}

/**
 * Zone 2 for a high councilor. Audits, recommends and metrics are deliberately
 * absent — a high counselor seeing the stake's audit backlog is noise he can do
 * nothing about, and the RLS in migration 019 doesn't serve him those rows anyway.
 */
export function highCouncilTiles(input: TileInput): TileSpec[] {
  const { openItems, interviews, standardWork, myId, myName, hcVoteCount, t, language } = input;

  const mine = openItems.filter(i => isMine(i, myId, myName));
  const myAssignments = mine.filter(i => i.kind === 'assignment');
  const myInterviews = interviews.filter(
    i => (myId && i.assigned_to_user_id === myId) || (myName && i.assignee_name === myName),
  );
  const myInterviewsDone = myInterviews.filter(i => !!i.completed_at).length;
  const nextInterview = myInterviews.find(i => !i.completed_at && i.scheduled_for);

  const swDone = standardWork.filter(r => r.value === 'y').length;
  const weekOf = standardWork[0]?.period_start;

  return [
    {
      key: 'myAssignments',
      kind: 'assignment',
      value: String(myAssignments.length),
      unit: t('dash.unit.open'),
      label: t('dash.tile.myAssignments'),
      sub: t('dash.sub.givenByPresidency'),
      flag: lateFlag(myAssignments, t),
      drill: 'assignment',
    },
    {
      key: 'myVotes',
      kind: 'calling',
      value: String(hcVoteCount),
      unit: hcVoteCount === 1 ? t('dash.unit.card') : t('dash.unit.cards'),
      label: t('dash.tile.myVotes'),
      sub: t('dash.sub.onTheHcBoard'),
    },
    {
      key: 'myInterview',
      kind: 'interview',
      value: `${myInterviewsDone} ${t('dash.unit.of')} ${myInterviews.length}`,
      unit: t('dash.unit.done'),
      label: t('dash.tile.myInterview'),
      sub: nextInterview?.scheduled_for
        ? `${nextInterview.interviewee_name} · ${formatMonthDay(nextInterview.scheduled_for, language)}`
        : t('dash.sub.nothingScheduled'),
      drill: 'myInterview',
    },
    {
      key: 'standard',
      kind: 'standard',
      value: `${swDone} ${t('dash.unit.of')} ${standardWork.length}`,
      unit: t('dash.unit.done'),
      label: t('dash.tile.myStandardWork'),
      sub: joinParts([
        t('dash.sub.recurringFromSteward'),
        weekOf ? `${t('dash.sub.weekOf')} ${formatMonthDay(weekOf, language)}` : null,
      ]),
      drill: 'standard',
    },
  ];
}

/** Zone 3. Progress is over ALL items in the workstream, done ones included. */
export function workstreamSpecs(
  workstreams: Workstream[],
  allItems: DashboardItem[],
  language: Lang,
): WorkstreamSpec[] {
  return workstreams.map(w => {
    const mine = allItems.filter(i => i.workstream_id === w.id);
    const done = mine.filter(i => i.status === 'done').length;
    const next = mine.filter(isOpen).sort(byDueDate)[0];
    return {
      id: w.id,
      name: w.name,
      color: w.color || '#1B3A6B',
      done,
      total: mine.length,
      targetLabel: w.target_date ? formatMonthDay(w.target_date, language) : undefined,
      nextLabel: next?.title,
    };
  });
}

/** Rows behind a tile. Kept next to the tile builders so a tile and its
 *  drill-down can never disagree about what the number meant. */
export function itemsForDrill(drill: DrillKey, openItems: DashboardItem[]): DashboardItem[] {
  if (drill.startsWith('ws:')) {
    const id = drill.slice(3);
    return openItems.filter(i => i.workstream_id === id).sort(byDueDate);
  }
  return openItems.filter(i => i.kind === drill).sort(byDueDate);
}
