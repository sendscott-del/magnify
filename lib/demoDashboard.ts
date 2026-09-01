import type {
  DashboardItem,
  DashInterview,
  MetricDef,
  MetricPoint,
  StandardWorkRow,
  Workstream,
} from './dashboard';
import { currentQuarter, quarterStartISO, todayISO } from './dashboard';

/**
 * Demo fixtures for the dashboard — fake items, workstreams, interviews and
 * metrics so a trainer (or App Review) can walk the whole screen without any
 * real stake data. Same shapes as the live tables.
 *
 * Confidentiality: names here are invented, and every title is a scheduling
 * shell. Nothing in this file may describe why an interview is happening —
 * the same rule that governs real items.
 */

function isoInDays(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  const m = `${t.getMonth() + 1}`.padStart(2, '0');
  const day = `${t.getDate()}`.padStart(2, '0');
  return `${t.getFullYear()}-${m}-${day}`;
}

function isoTimeAgo(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() - days);
  return t.toISOString();
}

export const DEMO_STAKE_ID = 'demo-stake';

/** Sentinel owner id in the fixtures; the hook swaps it for the signed-in
 *  user's real id so the "Mine" scope isn't empty in the demo. */
export const DEMO_ME = 'demo-me';

export const DEMO_WORKSTREAMS: Workstream[] = [
  { id: 'dws-1', name: 'Stake Conference — November', color: '#1B3A6B', target_date: isoInDays(72),  status: 'active', sort_order: 1, description: null },
  { id: 'dws-2', name: 'Q3 ward audits',              color: '#F97316', target_date: isoInDays(15),  status: 'active', sort_order: 2, description: null },
  { id: 'dws-3', name: 'Temple recommend push',       color: '#14B8A6', target_date: isoInDays(45),  status: 'active', sort_order: 3, description: null },
  { id: 'dws-4', name: 'Bishops Council follow-ups',  color: '#8B5CF6', target_date: isoInDays(9),   status: 'active', sort_order: 4, description: null },
];

interface Seed {
  kind: DashboardItem['kind'];
  title: string;
  detail?: string;
  due: number;
  owner?: string;
  ws?: string;
  source?: DashboardItem['source'];
  status?: DashboardItem['status'];
  review?: DashboardItem['review_state'];
  meeting?: string;
}

const SEEDS: Seed[] = [
  // Overdue and due-soon — these populate Zone 1.
  { kind: 'recommend',  title: 'Temple recommend interview — Br. Alvarado', detail: 'Hyde Park 1st',      due: -12, owner: 'Pres. Shurtliff', ws: 'dws-3', source: 'lcr_sync' },
  { kind: 'audit',      title: 'Ward audit review — Blue Island',           detail: 'Q3 deadline Sep 15', due: -3,  owner: 'Pres. Shurtliff', ws: 'dws-2', source: 'lcr_sync' },
  { kind: 'directive',  title: 'Respond to area YSA committee request',     detail: 'From the Area Seventy', due: 0, owner: 'Pres. Shurtliff' },
  { kind: 'action',     title: 'Confirm stake conference broadcast plan',   detail: 'From Stake Presidency, Aug 24', due: 2, owner: 'Pres. Shurtliff', ws: 'dws-1', source: 'meeting', meeting: 'Stake Presidency' },
  { kind: 'assignment', title: 'Ward council visit — Moraine Valley',       detail: 'Assigned to Br. Whitfield', due: 4, owner: 'Br. Whitfield', ws: 'dws-4' },
  { kind: 'interview',  title: 'Quarterly interview — Bishop Nakamura',     detail: 'Westchester 1st',    due: 6,  owner: 'Pres. Kimball' },
  { kind: 'recommend',  title: 'Temple recommend interview — Sis. Ferreira', detail: 'Midway',            due: 7,  owner: 'Pres. Kimball', ws: 'dws-3', source: 'lcr_sync' },

  // Beyond the urgent window — these feed the "+ N more" line and the tiles.
  { kind: 'assignment', title: 'Prepare high council report — welfare',     detail: 'Assigned to Br. Oduya',  due: 12, owner: 'Br. Oduya',      ws: 'dws-4' },
  { kind: 'assignment', title: 'Ward conference agenda — Chicago 2nd',      detail: 'Assigned to Br. Lindquist', due: 18, owner: 'Br. Lindquist' },
  { kind: 'assignment', title: 'Youth activity coordination',               detail: 'Assigned to Br. Whitfield', due: 21, owner: 'Br. Whitfield' },
  { kind: 'audit',      title: 'Ward audit review — Chicago 2nd',           detail: 'Q3 deadline Sep 15', due: 9,  owner: 'Pres. Kimball',  ws: 'dws-2', source: 'lcr_sync' },
  { kind: 'audit',      title: 'Ward audit review — Westchester 1st',       detail: 'Q3 deadline Sep 15', due: 14, owner: 'Pres. Kimball',  ws: 'dws-2', source: 'lcr_sync' },
  { kind: 'directive',  title: 'Submit seminary enrollment summary',        detail: 'Received Aug 12',    due: 25, owner: 'Pres. Shurtliff' },
  { kind: 'recommend',  title: 'Temple recommend interview — Br. Sandoval', detail: 'Blue Island',        due: 16, owner: 'Pres. Shurtliff', ws: 'dws-3', source: 'lcr_sync' },
  { kind: 'recommend',  title: 'Temple recommend interview — Sis. Okafor',  detail: 'Hyde Park 3rd',      due: 19, owner: 'Pres. Kimball',  ws: 'dws-3', source: 'lcr_sync' },
  { kind: 'action',     title: 'Book stake center for conference sessions', detail: 'From Stake Presidency, Aug 24', due: 30, owner: 'Pres. Shurtliff', ws: 'dws-1', source: 'meeting', meeting: 'Stake Presidency' },
  { kind: 'action',     title: 'Draft conference program',                  detail: 'From Stake Presidency, Aug 24', due: 40, owner: 'Pres. Kimball',  ws: 'dws-1', source: 'meeting', meeting: 'Stake Presidency' },
  { kind: 'action',     title: 'Invite visiting authority',                 detail: 'From Stake Presidency, Aug 24', due: 50, owner: 'Pres. Shurtliff', ws: 'dws-1', source: 'meeting', meeting: 'Stake Presidency' },

  // Already done — drives the workstream tick counts.
  { kind: 'action',     title: 'Reserve overflow parking',                  due: -20, owner: 'Pres. Kimball',  ws: 'dws-1', status: 'done' },
  { kind: 'action',     title: 'Confirm conference dates with the Area',    due: -30, owner: 'Pres. Shurtliff', ws: 'dws-1', status: 'done' },
  { kind: 'audit',      title: 'Ward audit review — Hyde Park 1st',         due: -8,  owner: 'Pres. Kimball',  ws: 'dws-2', status: 'done' },
  { kind: 'audit',      title: 'Ward audit review — Midway',                due: -6,  owner: 'Pres. Kimball',  ws: 'dws-2', status: 'done' },
  { kind: 'assignment', title: 'Bishops Council minutes distributed',       due: -4,  owner: 'Br. Oduya',      ws: 'dws-4', status: 'done' },
  { kind: 'recommend',  title: 'Temple recommend interview — Br. Halvorsen', due: -9, owner: 'Pres. Shurtliff', ws: 'dws-3', status: 'done' },

  // Waiting in the meeting review queue — invisible everywhere else.
  { kind: 'action',     title: 'Follow up on ward clerk training dates',    due: 10, owner: 'Pres. Shurtliff', source: 'meeting', meeting: 'High Council', review: 'pending_review' },
  { kind: 'assignment', title: 'Assign a high counselor to Blue Island',    due: 13, owner: 'Br. Lindquist',   source: 'meeting', meeting: 'High Council', review: 'pending_review' },
  { kind: 'action',     title: 'Schedule bishop training on welfare',       due: 20, owner: 'Pres. Kimball',   source: 'meeting', meeting: 'Bishops Council', review: 'pending_review' },
];

export const DEMO_ITEMS: DashboardItem[] = SEEDS.map((s, i) => ({
  id: `ditem-${i}`,
  stake_id: DEMO_STAKE_ID,
  kind: s.kind,
  title: s.title,
  detail: s.detail ?? null,
  status: s.status ?? 'open',
  owner_user_id: s.owner === 'Pres. Shurtliff' ? DEMO_ME : null,
  owner_label: s.owner ?? null,
  due_on: isoInDays(s.due),
  ward_id: null,
  workstream_id: s.ws ?? null,
  meeting_id: s.meeting ? `dmtg-${s.meeting}` : null,
  source: s.source ?? 'manual',
  source_ref: s.meeting ? { meeting: s.meeting } : {},
  review_state: s.review ?? 'approved',
  created_at: isoTimeAgo(Math.abs(s.due) + 5),
  updated_at: isoTimeAgo(1),
  completed_at: s.status === 'done' ? isoTimeAgo(1) : null,
}));

export const DEMO_INTERVIEWS: DashInterview[] = [
  { id: 'div-1',  interviewee_name: 'Bishop Nakamura',  interviewee_calling: 'Bishop, Westchester 1st', assignee_name: 'Pres. Kimball',    assigned_to_user_id: null,      scheduled_for: isoInDays(6),  completed_at: null },
  { id: 'div-2',  interviewee_name: 'Bishop Arreola',   interviewee_calling: 'Bishop, Midway',          assignee_name: 'Pres. Shurtliff',  assigned_to_user_id: DEMO_ME, scheduled_for: isoInDays(11), completed_at: null },
  { id: 'div-3',  interviewee_name: 'Bishop Toluwase',  interviewee_calling: 'Bishop, Blue Island',     assignee_name: 'Pres. Shurtliff',  assigned_to_user_id: DEMO_ME, scheduled_for: isoInDays(-4), completed_at: isoInDays(-4) },
  { id: 'div-4',  interviewee_name: 'Bishop Renner',    interviewee_calling: 'Bishop, Hyde Park 1st',   assignee_name: 'Pres. Kimball',    assigned_to_user_id: null,      scheduled_for: isoInDays(-9), completed_at: isoInDays(-9) },
  { id: 'div-5',  interviewee_name: 'Sis. Vandermeer',  interviewee_calling: 'Stake Relief Society',    assignee_name: 'Pres. Shurtliff',  assigned_to_user_id: DEMO_ME, scheduled_for: isoInDays(-14), completed_at: isoInDays(-14) },
  { id: 'div-6',  interviewee_name: 'Br. Whitfield',    interviewee_calling: 'High Council',            assignee_name: 'Pres. Kimball',    assigned_to_user_id: null,      scheduled_for: isoInDays(-2), completed_at: isoInDays(-2) },
  { id: 'div-7',  interviewee_name: 'Br. Oduya',        interviewee_calling: 'High Council',            assignee_name: 'Pres. Shurtliff',  assigned_to_user_id: DEMO_ME, scheduled_for: isoInDays(-6), completed_at: isoInDays(-6) },
  { id: 'div-8',  interviewee_name: 'Br. Lindquist',    interviewee_calling: 'High Council',            assignee_name: 'Pres. Kimball',    assigned_to_user_id: null,      scheduled_for: isoInDays(-1), completed_at: isoInDays(-1) },
  { id: 'div-9',  interviewee_name: 'Bishop Cazares',   interviewee_calling: 'Bishop, Chicago 2nd',     assignee_name: null,               assigned_to_user_id: null,      scheduled_for: null,          completed_at: null },
  { id: 'div-10', interviewee_name: 'Bishop Yildiz',    interviewee_calling: 'Bishop, Hyde Park 2nd',   assignee_name: null,               assigned_to_user_id: null,      scheduled_for: null,          completed_at: null },
  { id: 'div-11', interviewee_name: 'Bishop Delacroix', interviewee_calling: 'Bishop, Hyde Park 3rd',   assignee_name: null,               assigned_to_user_id: null,      scheduled_for: null,          completed_at: null },
  { id: 'div-12', interviewee_name: 'Bishop Marchetti', interviewee_calling: 'Bishop, Moraine Valley',  assignee_name: null,               assigned_to_user_id: null,      scheduled_for: null,          completed_at: null },
];

export const DEMO_STANDARD_WORK: StandardWorkRow[] = [
  { id: 'dsw-1', name: 'Attend bishopric meeting — Blue Island',      frequency: 'weekly',  category_name: 'Ward support', period_start: todayISO(), value: 'y',  shared_task_id: null },
  { id: 'dsw-2', name: 'Visit an assigned ward sacrament meeting',    frequency: 'weekly',  category_name: 'Ward support', period_start: todayISO(), value: 'y',  shared_task_id: null },
  { id: 'dsw-3', name: 'Minister to assigned bishop, check-in call',  frequency: 'weekly',  category_name: 'Ministering',  period_start: todayISO(), value: 'y',  shared_task_id: null },
  { id: 'dsw-4', name: 'Ward council attendance — Moraine Valley',    frequency: 'monthly', category_name: 'Ward support', period_start: todayISO(), value: null, shared_task_id: null },
  { id: 'dsw-5', name: 'Report to Stake Council',                     frequency: 'monthly', category_name: 'Stake',        period_start: todayISO(), value: null, shared_task_id: null },
];

export const DEMO_METRIC_DEFS: MetricDef[] = [
  { metric_key: 'endowed_current_recommend', label: 'Endowed with current recommend',  label_es: 'Investidos con recomendación vigente', unit: 'members',   direction: 'up', sort_order: 1 },
  { metric_key: 'convert_baptisms_12mo',     label: 'Convert baptisms, rolling 12 mo', label_es: 'Bautismos de conversos, 12 meses',    unit: 'baptisms',  direction: 'up', sort_order: 2 },
  { metric_key: 'sacrament_attendance',      label: 'Sacrament meeting attendance',    label_es: 'Asistencia a la reunión sacramental', unit: 'attending', direction: 'up', sort_order: 3 },
  { metric_key: 'ministering_interviews',    label: 'Ministering interviews completed', label_es: 'Entrevistas de ministración',        unit: 'completed', direction: 'up', sort_order: 4 },
  { metric_key: 'members_with_callings',     label: 'Members with callings',           label_es: 'Miembros con llamamientos',           unit: 'members',   direction: 'up', sort_order: 5 },
  { metric_key: 'convert_retention',         label: 'Convert retention',               label_es: 'Retención de conversos',              unit: '%',         direction: 'up', sort_order: 6 },
];

// Eight quarters ending at the current one, so the sparkline always has a
// full series regardless of when the demo is opened.
const DEMO_SERIES: Record<string, { values: number[]; target: number }> = {
  endowed_current_recommend: { values: [455, 470, 488, 496, 505, 511, 527, 527], target: 750 },
  convert_baptisms_12mo:     { values: [162, 178, 195, 221, 244, 262, 280, 215], target: 350 },
  sacrament_attendance:      { values: [1020, 1044, 1078, 1096, 1120, 1142, 1165, 1255], target: 1500 },
  ministering_interviews:    { values: [96, 112, 128, 141, 158, 170, 183, 142], target: 400 },
  members_with_callings:     { values: [842, 858, 871, 884, 899, 910, 922, 944], target: 825 },
  convert_retention:         { values: [41, 44, 46, 48, 50, 51, 52, 58], target: 80 },
};

export const DEMO_METRICS: MetricPoint[] = (() => {
  const { year, quarter } = currentQuarter();
  const out: MetricPoint[] = [];
  for (const [key, series] of Object.entries(DEMO_SERIES)) {
    series.values.forEach((value, i) => {
      // i = 0 is seven quarters back; the last entry is the current quarter.
      const offset = series.values.length - 1 - i;
      let q = quarter - offset;
      let y = year;
      while (q < 1) { q += 4; y -= 1; }
      out.push({
        metric_key: key,
        period_start: quarterStartISO(y, q),
        value,
        target: series.target,
        synced_at: isoTimeAgo(2),
      });
    });
  }
  return out;
})();

export const DEMO_CALLING_STAGE_COUNTS: Record<string, number> = {
  ideas: 3,
  for_approval: 2,
  stake_approved: 2,
  hc_approval: 1,
  sustain: 1,
};

export const DEMO_WARD_COUNT = 9;
