import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';
import { useDemoMode, isReviewDemoUser } from '../context/DemoModeContext';
import {
  Building, HcRotation, ReminderSent, ScheduleAssignment, ScheduleMeeting,
  ScheduleWeek, StakeSettings, TravelMinutes, WardMeetingTime, WeekKind, Seat,
  MeetingBody, MeetingFormat, comingSundayISO,
} from './schedule';
import { WardRef } from './useDashboardData';
import { DEMO_SUNDAY } from './demoSchedule';

/**
 * Data access for the Sunday schedule. Everything reads the schedule tables
 * directly under RLS: a high councilor's query for building assignments
 * simply returns no rows, and the UI treats an empty set as "not yours to
 * see" rather than as an error. Writes go through plain inserts/updates —
 * the tables have no cross-table policy subqueries, so no RPC is needed.
 */

export interface ReferenceData {
  buildings: Building[];
  wardTimes: WardMeetingTime[];
  travel: TravelMinutes[];
  settings: StakeSettings | null;
  wards: WardRef[];
  hcMembers: Array<{ id: string; name: string; user_id: string | null }>;
}

export interface WeekBundle {
  week: ScheduleWeek | null;
  meetings: ScheduleMeeting[];
  assignments: ScheduleAssignment[];
  rotation: HcRotation | null;
  reminders: ReminderSent[];
  note: string;
}

export async function loadReference(): Promise<ReferenceData> {
  const [b, wt, tr, st, w, hc] = await Promise.all([
    supabase.from('magnify_buildings').select('id, name, short_name, address').order('sort_order'),
    supabase.from('magnify_ward_meeting_times').select('ward_id, building_id, sacrament_at, duration_min'),
    supabase.from('magnify_travel_minutes').select('from_building_id, to_building_id, minutes'),
    supabase.from('magnify_stake_settings').select('*').limit(1).maybeSingle(),
    supabase.from('wards').select('id, name, abbreviation').order('sort_order'),
    supabase.from('high_council_members').select('id, name, user_id').eq('active', true).order('sort_order'),
  ]);
  return {
    buildings: (b.data ?? []) as Building[],
    wardTimes: (wt.data ?? []) as WardMeetingTime[],
    travel: (tr.data ?? []) as TravelMinutes[],
    settings: (st.data ?? null) as StakeSettings | null,
    wards: (w.data ?? []) as WardRef[],
    hcMembers: (hc.data ?? []) as Array<{ id: string; name: string; user_id: string | null }>,
  };
}

export async function loadWeek(sundayISO: string, hcNames: Record<string, string> = {}): Promise<WeekBundle> {
  const { data: week } = await supabase
    .from('magnify_schedule_weeks')
    .select('id, sunday_on, kind, holiday_label')
    .eq('sunday_on', sundayISO)
    .maybeSingle();
  if (!week) return { week: null, meetings: [], assignments: [], rotation: null, reminders: [], note: '' };

  const [m, a, r, s, n] = await Promise.all([
    supabase.from('magnify_schedule_meetings').select('*').eq('week_id', week.id).order('sort_order'),
    supabase.from('magnify_schedule_assignments').select('week_id, seat, ward_id').eq('week_id', week.id),
    supabase.from('magnify_hc_rotation').select('week_id, hc_member_id, reason').eq('week_id', week.id).maybeSingle(),
    supabase.from('magnify_reminders_sent').select('id, week_id, channel, target, recipient_count, sent_at').eq('week_id', week.id),
    supabase.from('magnify_schedule_notes').select('note').eq('week_id', week.id).maybeSingle(),
  ]);
  const rot = (r.data ?? null) as HcRotation | null;
  return {
    week: week as ScheduleWeek,
    meetings: (m.data ?? []) as ScheduleMeeting[],
    assignments: (a.data ?? []) as ScheduleAssignment[],
    rotation: rot ? { ...rot, member_name: hcNames[rot.hc_member_id] ?? null } : null,
    reminders: (s.data ?? []) as ReminderSent[],
    note: (n.data as { note?: string } | null)?.note ?? '',
  };
}

export interface YearRow {
  week: ScheduleWeek;
  meetings: ScheduleMeeting[];
  assignments: ScheduleAssignment[];
}

export async function loadYear(year: number): Promise<YearRow[]> {
  const { data: weeks } = await supabase
    .from('magnify_schedule_weeks')
    .select('id, sunday_on, kind, holiday_label')
    .gte('sunday_on', `${year}-01-01`)
    .lte('sunday_on', `${year}-12-31`)
    .order('sunday_on');
  const ids = (weeks ?? []).map(w => w.id);
  if (!ids.length) return [];
  const [m, a] = await Promise.all([
    supabase.from('magnify_schedule_meetings').select('*').in('week_id', ids).order('sort_order'),
    supabase.from('magnify_schedule_assignments').select('week_id, seat, ward_id').in('week_id', ids),
  ]);
  const meetings = (m.data ?? []) as ScheduleMeeting[];
  const assignments = (a.data ?? []) as ScheduleAssignment[];
  return (weeks as ScheduleWeek[]).map(week => ({
    week,
    meetings: meetings.filter(x => x.week_id === week.id),
    assignments: assignments.filter(x => x.week_id === week.id),
  }));
}

export interface WeekDraft {
  id?: string | null;
  sunday_on: string;
  kind: WeekKind;
  holiday_label: string | null;
  meetings: Array<{ body: MeetingBody; starts_at: string; ends_at: string; format: MeetingFormat; label: string | null; day_offset?: number }>;
  assignments: Array<{ seat: Seat; ward_id: string }>;
  hc_member_id: string | null;
  reason: string | null;
  note: string;
  /** Presidency only; clerks cannot write the notes table. */
  canWriteNote: boolean;
}

/**
 * Save a Sunday: upsert the week, then replace its meetings, assignments and
 * companion wholesale. Small tables, small rows; replacing is simpler and
 * safer than diffing, and the editor always submits the full picture.
 */
export async function saveWeek(draft: WeekDraft): Promise<{ error: string | null; weekId: string | null }> {
  let weekId = draft.id ?? null;
  if (weekId) {
    const { error } = await supabase.from('magnify_schedule_weeks')
      .update({ kind: draft.kind, holiday_label: draft.holiday_label })
      .eq('id', weekId);
    if (error) return { error: error.message, weekId };
  } else {
    const { data, error } = await supabase.from('magnify_schedule_weeks')
      .insert({ sunday_on: draft.sunday_on, kind: draft.kind, holiday_label: draft.holiday_label })
      .select('id').single();
    if (error) return { error: error.message, weekId: null };
    weekId = data.id as string;
  }

  const delM = await supabase.from('magnify_schedule_meetings').delete().eq('week_id', weekId);
  if (delM.error) return { error: delM.error.message, weekId };
  if (draft.meetings.length) {
    const { error } = await supabase.from('magnify_schedule_meetings').insert(
      draft.meetings.map((m, i) => ({ week_id: weekId, body: m.body, starts_at: m.starts_at, ends_at: m.ends_at, format: m.format, label: m.label, sort_order: i, day_offset: m.day_offset ?? 0 })),
    );
    if (error) return { error: error.message, weekId };
  }

  const delA = await supabase.from('magnify_schedule_assignments').delete().eq('week_id', weekId);
  if (delA.error) return { error: delA.error.message, weekId };
  if (draft.assignments.length) {
    const { error } = await supabase.from('magnify_schedule_assignments').insert(
      draft.assignments.map(a => ({ week_id: weekId, seat: a.seat, ward_id: a.ward_id })),
    );
    if (error) return { error: error.message, weekId };
  }

  const delR = await supabase.from('magnify_hc_rotation').delete().eq('week_id', weekId);
  if (delR.error) return { error: delR.error.message, weekId };
  if (draft.hc_member_id) {
    const { error } = await supabase.from('magnify_hc_rotation').insert({ week_id: weekId, hc_member_id: draft.hc_member_id, reason: draft.reason });
    if (error) return { error: error.message, weekId };
  }

  if (draft.canWriteNote) {
    if (draft.note.trim()) {
      const { error } = await supabase.from('magnify_schedule_notes').upsert({ week_id: weekId, note: draft.note.trim() });
      if (error) return { error: error.message, weekId };
    } else {
      await supabase.from('magnify_schedule_notes').delete().eq('week_id', weekId);
    }
  }
  return { error: null, weekId };
}

export async function logReminder(row: {
  week_id: string; channel: 'slack' | 'tidings'; target: string; body: string; recipient_count?: number | null;
}): Promise<ReminderSent | null> {
  const { data } = await supabase.from('magnify_reminders_sent').insert(row)
    .select('id, week_id, channel, target, recipient_count, sent_at').single();
  return (data ?? null) as ReminderSent | null;
}

/** The webhook URLs for the reminder channels, keyed by event_type. */
export async function loadReminderWebhooks(): Promise<Record<string, string>> {
  const { data } = await supabase.from('slack_settings')
    .select('event_type, webhook_url')
    .eq('active', true)
    .in('event_type', ['sp_reminder', 'hc_reminder', 'sc_reminder', 'sprs_reminder']);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.webhook_url) out[row.event_type] = row.webhook_url;
  return out;
}

// ----------------------------------------------------------------- hook --

export interface SundayData {
  loading: boolean;
  sundayISO: string;
  reference: ReferenceData;
  bundle: WeekBundle;
  refresh: () => Promise<void>;
  /** Optimistic append after a reminder goes out. */
  addReminder: (r: ReminderSent) => void;
}

const EMPTY_REF: ReferenceData = { buildings: [], wardTimes: [], travel: [], settings: null, wards: [], hcMembers: [] };
const EMPTY_BUNDLE: WeekBundle = { week: null, meetings: [], assignments: [], rotation: null, reminders: [], note: '' };

/** The coming Sunday's schedule for the This Sunday card. */
export function useSunday(): SundayData {
  const { user, profile, loading: authLoading } = useAuth();
  const { demoMode } = useDemoMode();
  const isDemo = demoMode || isReviewDemoUser(profile?.email) || profile?.is_demo === true;
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState<ReferenceData>(EMPTY_REF);
  const [bundle, setBundle] = useState<WeekBundle>(EMPTY_BUNDLE);
  const sundayISO = comingSundayISO();
  const runId = useRef(0);

  const refresh = useCallback(async () => {
    const myRun = ++runId.current;
    if (authLoading) return;
    if (isDemo) {
      setReference(DEMO_SUNDAY.reference);
      setBundle(DEMO_SUNDAY.bundle(sundayISO));
      setLoading(false);
      return;
    }
    if (!user?.id) { setLoading(false); return; }
    const ref = await loadReference();
    const names: Record<string, string> = {};
    for (const m of ref.hcMembers) names[m.id] = m.name;
    const b = await loadWeek(sundayISO, names);
    if (myRun !== runId.current) return;
    setReference(ref);
    setBundle(b);
    setLoading(false);
  }, [authLoading, isDemo, user?.id, sundayISO]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addReminder = useCallback((r: ReminderSent) => {
    setBundle(prev => ({ ...prev, reminders: [...prev.reminders, r] }));
  }, []);

  return { loading, sundayISO, reference, bundle, refresh, addReminder };
}
