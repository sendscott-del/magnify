import { TranslationKey } from '../constants/translations';
import { parseDate, todayISO } from './dashboard';

/**
 * Sunday schedule — types and the pure functions behind the This Sunday
 * card: building a presidency member's day, the drives between buildings,
 * and the conflicts, from schedule rows alone. No data access here so the
 * builder is testable and the same on every surface.
 *
 * Rules (docs/design_handoff_sunday_schedule/README.md): morning meetings are
 * at the stake offices unless format = zoom; one sacrament meeting per ward in
 * the viewer's column at the ward's start time, 70 minutes; a drive block
 * between consecutive events in different buildings; a conflict when events
 * overlap or the gap is shorter than the drive. The card states the fix in
 * words and never reorders the day itself.
 */

export type WeekKind = 'meetings' | 'holiday' | 'stake_conference' | 'general_conference' | 'ward_conference' | 'none';
export type MeetingBody = 'SP' | 'SP_RS' | 'HC' | 'HC_1on1' | 'SC' | 'BC' | 'ADULT_LEADERSHIP' | 'TRAINING' | 'WARD_CONFERENCE' | 'OTHER';
export type MeetingFormat = 'in_person' | 'zoom';
export type Seat = 'P' | '1C' | '2C';

export const WEEK_KINDS: WeekKind[] = ['meetings', 'holiday', 'stake_conference', 'general_conference', 'ward_conference', 'none'];
export const MEETING_BODIES: MeetingBody[] = ['SP', 'SP_RS', 'HC', 'HC_1on1', 'SC', 'BC', 'ADULT_LEADERSHIP', 'TRAINING', 'WARD_CONFERENCE', 'OTHER'];
export const SEATS: Seat[] = ['P', '1C', '2C'];

export interface ScheduleWeek {
  id: string;
  sunday_on: string;       // YYYY-MM-DD
  kind: WeekKind;
  holiday_label?: string | null;
}

export interface ScheduleMeeting {
  id: string;
  week_id: string;
  body: MeetingBody;
  starts_at: string;       // HH:MM or HH:MM:SS
  ends_at: string;
  format: MeetingFormat;
  label?: string | null;
  sort_order: number;
}

export interface ScheduleAssignment {
  week_id: string;
  seat: Seat;
  ward_id: string;
}

export interface Building {
  id: string;
  name: string;
  short_name: string;
  address?: string | null;
}

export interface WardMeetingTime {
  ward_id: string;
  building_id: string;
  sacrament_at: string;
  duration_min: number;
}

export interface TravelMinutes {
  from_building_id: string;
  to_building_id: string;
  minutes: number;
}

export interface StakeSettings {
  offices_building_id?: string | null;
  sp_zoom_url?: string | null;
  sp_zoom_note?: string | null;
  leadership_zoom_url?: string | null;
  leadership_zoom_note?: string | null;
  tidings_sender_id?: string | null;
  tidings_hc_list_id?: string | null;
  tidings_sc_list_id?: string | null;
}

export interface HcRotation {
  week_id: string;
  hc_member_id: string;
  reason?: string | null;
  member_name?: string | null;
}

export interface ReminderSent {
  id: string;
  week_id: string;
  channel: 'slack' | 'tidings';
  target: string;
  recipient_count?: number | null;
  sent_at: string;
}

// ----------------------------------------------------------------- time --

/** 'HH:MM[:SS]' → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** minutes since midnight → 'H:MM' (no leading zero, no am/pm). */
export function fmtClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${`${m}`.padStart(2, '0')}`;
}

/** minutes → 'H:MMam' / 'H:MMpm', the form Scott uses in reminders. */
export function fmtClockAmPm(min: number): string {
  return `${fmtClock(min)}${min < 12 * 60 ? 'am' : 'pm'}`;
}

/** minutes → 'HH:MM' for a time column. */
export function toHHMM(min: number): string {
  return `${`${Math.floor(min / 60)}`.padStart(2, '0')}:${`${min % 60}`.padStart(2, '0')}`;
}

/** The next Sunday on or after today (today if today is Sunday). */
export function comingSundayISO(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Friday, Saturday, Sunday: the days the card shows by default. */
export function isCardWindow(now: Date = new Date()): boolean {
  const dow = now.getDay();
  return dow === 5 || dow === 6 || dow === 0;
}

export function formatSundayLong(iso: string, language: 'en' | 'es'): string {
  return parseDate(iso).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

/** 'M/D' for reminder bodies. */
export function formatMD(iso: string): string {
  const d = parseDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function sundayIsPast(iso: string): boolean {
  return iso < todayISO();
}

// ------------------------------------------------------------- timeline --

export interface TimelineEvent {
  kind: 'meeting' | 'sacrament' | 'drive' | 'other';
  title: string;
  /** Minutes since midnight. Drives use leave-by as start. */
  start: number;
  end: number;
  buildingId: string | null;   // null = zoom / no travel
  buildingName?: string | null;
  meta?: string;
  /** For drives: minutes. */
  minutes?: number;
  /** A conflict message attached to this row. */
  conflict?: string;
}

export interface TimelineInput {
  week: ScheduleWeek | null;
  meetings: ScheduleMeeting[];
  /** Wards the viewer visits (already narrowed to their seat). */
  wardIds: string[];
  wardNames: Record<string, string>;
  wardTimes: WardMeetingTime[];
  buildings: Building[];
  travel: TravelMinutes[];
  settings: StakeSettings | null;
  /** Which meeting bodies this viewer attends. Others are dropped. */
  bodiesFor: (body: MeetingBody) => boolean;
  t: (key: TranslationKey) => string;
}

export interface Timeline {
  events: TimelineEvent[];
  conflicts: string[];
}

function bodyLabel(body: MeetingBody, t: (k: TranslationKey) => string): string {
  return t(`schedule.body.${body}` as TranslationKey);
}

export function formatLabel(format: MeetingFormat, t: (k: TranslationKey) => string): string {
  return t(format === 'zoom' ? 'schedule.format.zoom' : 'schedule.format.inPerson');
}

/** Round up to the next quarter hour — what a human would propose. */
function roundUpQuarter(min: number): number {
  return Math.ceil(min / 15) * 15;
}

/**
 * Build one person's Sunday. Events sorted by start; drives inserted between
 * consecutive events in different buildings; conflicts named in words.
 */
export function buildTimeline(input: TimelineInput): Timeline {
  const { week, meetings, wardIds, wardNames, wardTimes, buildings, travel, settings, bodiesFor, t } = input;
  const conflicts: string[] = [];
  if (!week) return { events: [], conflicts };

  const bName = (id: string | null | undefined) => buildings.find(b => b.id === id)?.short_name ?? null;
  const officesId = settings?.offices_building_id ?? null;
  const officesName = bName(officesId) ?? t('schedule.stakeOffices');

  const base: TimelineEvent[] = [];

  for (const m of meetings.filter(m => bodiesFor(m.body)).sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at) || a.sort_order - b.sort_order)) {
    const zoom = m.format === 'zoom';
    const start = toMinutes(m.starts_at);
    const end = toMinutes(m.ends_at);
    base.push({
      kind: 'meeting',
      title: m.label && m.body === 'OTHER' ? m.label : bodyLabel(m.body, t),
      start, end,
      buildingId: zoom ? null : officesId,
      buildingName: zoom ? null : officesName,
      meta: [zoom ? t('schedule.format.zoom') : `${officesName} · ${t('schedule.format.inPerson')}`, `${end - start} ${t('schedule.min')}`,
        m.label && m.body !== 'OTHER' ? m.label : null].filter(Boolean).join(' · '),
    });
  }

  for (const wardId of wardIds) {
    const wt = wardTimes.find(w => w.ward_id === wardId);
    const name = wardNames[wardId] ?? wardId;
    if (!wt) {
      conflicts.push(`${name}: ${t('schedule.conflict.noTime')}`);
      continue;
    }
    const start = toMinutes(wt.sacrament_at);
    base.push({
      kind: 'sacrament',
      title: `${name} ${t('schedule.sacrament')}`,
      start, end: start + wt.duration_min,
      buildingId: wt.building_id,
      buildingName: bName(wt.building_id),
      meta: `${wt.duration_min} ${t('schedule.min')} · ${bName(wt.building_id) ?? ''}`.trim(),
    });
  }

  base.sort((a, b) => a.start - b.start || a.end - b.end);

  const minutesBetween = (from: string | null, to: string | null): number | null => {
    if (!from || !to) return null;
    if (from === to) return 0;
    return travel.find(x => x.from_building_id === from && x.to_building_id === to)?.minutes ?? null;
  };

  const out: TimelineEvent[] = [];
  for (let i = 0; i < base.length; i++) {
    const ev = base[i];
    const prev = base[i - 1];
    if (prev) {
      // Overlap: two things at once. The card says pick one.
      if (ev.start < prev.end) {
        const msg = ev.start === prev.start
          ? t('schedule.conflict.sameTime').replace('{a}', prev.title).replace('{b}', ev.title).replace('{time}', fmtClock(ev.start))
          : t('schedule.conflict.overlap').replace('{a}', prev.title).replace('{b}', ev.title).replace('{end}', fmtClock(prev.end));
        conflicts.push(msg);
        ev.conflict = msg;
        out.push(ev);
        continue;
      }
      const drive = minutesBetween(prev.buildingId, ev.buildingId);
      if (drive === null && prev.buildingId && ev.buildingId) {
        const msg = t('schedule.conflict.noDrive').replace('{a}', prev.buildingName ?? '').replace('{b}', ev.buildingName ?? '');
        conflicts.push(msg);
        ev.conflict = msg;
      } else if (drive && drive > 0) {
        const leaveBy = ev.start - drive;
        out.push({
          kind: 'drive',
          title: `${t('schedule.driveTo')} ${ev.buildingName ?? ''}`,
          start: leaveBy, end: ev.start,
          buildingId: ev.buildingId,
          minutes: drive,
          meta: `${drive} ${t('schedule.min')} · ${t('schedule.leaveBy')} ${fmtClock(leaveBy)}`,
        });
        if (leaveBy < prev.end) {
          const proposed = roundUpQuarter(prev.end + drive);
          const msg = t('schedule.conflict.gap')
            .replace('{b}', ev.title).replace('{gap}', String(ev.start - prev.end))
            .replace('{drive}', String(drive)).replace('{time}', fmtClock(proposed));
          conflicts.push(msg);
          ev.conflict = msg;
        }
      }
    }
    out.push(ev);
  }

  return { events: out, conflicts };
}

// ---------------------------------------------------------- role filters --

export type ScheduleRole = 'stake_president' | 'first_counselor' | 'second_counselor' | 'stake_clerk' | 'exec_secretary' | 'high_councilor' | 'stake_council' | string;

/** Which meeting bodies a role is part of. Clerks and the presidency see all. */
export function bodiesForRole(role: ScheduleRole): (body: MeetingBody) => boolean {
  if (role === 'high_councilor') {
    return b => ['HC', 'HC_1on1', 'SC', 'TRAINING', 'ADULT_LEADERSHIP'].includes(b);
  }
  if (role === 'stake_council') {
    return b => ['SC', 'TRAINING', 'ADULT_LEADERSHIP'].includes(b);
  }
  return () => true;
}

export function seatForRole(role: ScheduleRole): Seat | null {
  if (role === 'stake_president') return 'P';
  if (role === 'first_counselor') return '1C';
  if (role === 'second_counselor') return '2C';
  return null;
}

// ------------------------------------------------------------ reminders --

export interface SlackReminder {
  /** slack_settings.event_type that carries this channel's webhook. */
  eventType: 'sp_reminder' | 'hc_reminder' | 'sc_reminder' | 'sprs_reminder';
  channelLabel: string;
  body: string;
}

const SLACK_ROUTE: Partial<Record<MeetingBody, SlackReminder['eventType']>> = {
  SP: 'sp_reminder',
  HC: 'hc_reminder',
  HC_1on1: 'hc_reminder',
  SC: 'sc_reminder',
  SP_RS: 'sprs_reminder',
  ADULT_LEADERSHIP: 'sprs_reminder',
};

const CHANNEL_LABEL: Record<SlackReminder['eventType'], string> = {
  sp_reminder: '#stake-presidency',
  hc_reminder: '#high-council',
  sc_reminder: '#stake-council',
  sprs_reminder: '#stake-presidency-stake-relief-society-presidency',
};

/**
 * The Slack posts for a Sunday, in the established wording. In-person and
 * Zoom phrasing follow the pattern the presidency already posts by hand;
 * the Zoom link comes from stake settings, never from the template.
 */
export function slackReminders(
  sundayISO: string,
  meetings: ScheduleMeeting[],
  settings: StakeSettings | null,
  t: (k: TranslationKey) => string,
): SlackReminder[] {
  const md = formatMD(sundayISO);
  const out: SlackReminder[] = [];
  for (const m of [...meetings].sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at))) {
    const eventType = SLACK_ROUTE[m.body];
    if (!eventType) continue;
    // "High Council meeting", "High Council meeting (1:1 interviews)" — the
    // wording Scott posts by hand (exec-sec section 2).
    const name = m.body === 'HC_1on1'
      ? 'High Council meeting (1:1 interviews)'
      : `${bodyLabel(m.body, t)} meeting`;
    const time = `${fmtClock(toMinutes(m.starts_at))}-${fmtClockAmPm(toMinutes(m.ends_at))}`;
    let where: string;
    if (m.format === 'zoom') {
      const url = m.body === 'SP' ? settings?.sp_zoom_url : settings?.leadership_zoom_url;
      const note = m.body === 'SP' ? settings?.sp_zoom_note : settings?.leadership_zoom_note;
      where = url ? `VIA ZOOM: ${url}${note ? ` (${note})` : ''}` : 'VIA ZOOM';
    } else {
      where = 'IN PERSON at the stake offices';
    }
    const mention = m.body === 'SP' ? '' : '<!channel> ';
    const tail = m.body === 'SP' ? '' : ' Please respond here if you are unable to make it.';
    out.push({
      eventType,
      channelLabel: CHANNEL_LABEL[eventType],
      body: `${mention}${name} will be held this Sunday (${md}) from ${time} ${where}.${tail}`,
    });
  }
  return out;
}

export interface TextReminder {
  lists: Array<'hc' | 'sc'>;
  body: string;
}

/**
 * The Tidings text for HC and/or SC. One message, both list ids when both
 * meet, so nobody on both lists is texted twice. Body matches what the
 * presidency already sends; the signature line is part of the body because
 * the dispatcher adds nothing.
 */
export function textReminder(
  sundayISO: string,
  meetings: ScheduleMeeting[],
  t: (k: TranslationKey) => string,
): TextReminder | null {
  const hc = meetings.find(m => m.body === 'HC' || m.body === 'HC_1on1');
  const sc = meetings.find(m => m.body === 'SC');
  if (!hc && !sc) return null;
  const md = formatMD(sundayISO);
  const lists: Array<'hc' | 'sc'> = [];
  if (hc) lists.push('hc');
  if (sc) lists.push('sc');

  const phrase = (m: ScheduleMeeting) => {
    const time = `${fmtClock(toMinutes(m.starts_at))}-${fmtClockAmPm(toMinutes(m.ends_at))}`;
    const where = m.format === 'zoom' ? 'VIA ZOOM' : 'IN PERSON at the stake offices';
    return `${time} ${where}`;
  };

  let line: string;
  if (hc && sc && hc.starts_at === sc.starts_at && hc.ends_at === sc.ends_at && hc.format === sc.format) {
    line = `High Council and Stake Council meet this Sunday (${md}) ${phrase(hc)}.`;
  } else if (hc && sc) {
    line = `This Sunday (${md}): High Council ${phrase(hc)}; Stake Council ${phrase(sc)}.`;
  } else if (hc) {
    const name = hc.body === 'HC_1on1' ? 'High Council meeting (1:1 interviews)' : 'High Council meeting';
    line = `${name} will be held this Sunday (${md}) from ${phrase(hc)}.`;
  } else {
    line = `Stake Council meeting will be held this Sunday (${md}) from ${phrase(sc!)}.`;
  }
  void t;
  return { lists, body: `${line}\n\n— Sent by the Stake Presidency` };
}

/** Sort weeks into quarters for the calendar list. */
export function quarterOf(iso: string): number {
  return Math.floor(parseDate(iso).getMonth() / 3) + 1;
}
