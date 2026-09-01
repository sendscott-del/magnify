import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';
import { useDemoMode, isReviewDemoUser } from '../context/DemoModeContext';
import {
  DashboardItem,
  DashInterview,
  MetricDef,
  MetricPoint,
  StandardWorkRow,
  Workstream,
  currentQuarter,
} from './dashboard';
import {
  DEMO_CALLING_STAGE_COUNTS,
  DEMO_ME,
  DEMO_INTERVIEWS,
  DEMO_ITEMS,
  DEMO_METRICS,
  DEMO_METRIC_DEFS,
  DEMO_STANDARD_WORK,
  DEMO_WARD_COUNT,
  DEMO_WORKSTREAMS,
} from './demoDashboard';

export interface OwnerOption {
  /** Present when the leader has a Magnify account; null for label-only. */
  userId: string | null;
  name: string;
  calling?: string | null;
}

export interface WardRef {
  id: string;
  name: string;
  abbreviation: string;
}

export interface DashboardData {
  loading: boolean;
  /**
   * Every approved item, INCLUDING completed ones — workstream tick counts are
   * "N of M done", so dropping done items here would make every workstream read
   * as 0%. Zones that only want open work filter on `status` themselves.
   */
  items: DashboardItem[];
  /** Extracted-from-meeting items awaiting human approval. */
  pending: DashboardItem[];
  workstreams: Workstream[];
  interviews: DashInterview[];
  standardWork: StandardWorkRow[];
  metrics: MetricPoint[];
  metricDefs: MetricDef[];
  callingStageCounts: Record<string, number>;
  wards: WardRef[];
  wardCount: number;
  owners: OwnerOption[];
  /** id → display name, for owner chips on items owned by an account. */
  ownerNames: Record<string, string>;
  stakeName: string | null;
  lastSyncedAt: string | null;
  refresh: () => Promise<void>;
  createItem: (patch: Partial<DashboardItem>) => Promise<void>;
  createWorkstream: (name: string, targetDate: string | null) => Promise<void>;
  setItemStatus: (id: string, done: boolean) => Promise<void>;
  updateItem: (id: string, patch: Partial<DashboardItem>) => Promise<void>;
  approvePending: (id: string) => Promise<void>;
  discardPending: (id: string) => Promise<void>;
  setStandardWorkDone: (behaviorId: string, done: boolean) => Promise<void>;
}


/**
 * One fetch for the whole dashboard.
 *
 * The load rule from the plan: the dashboard OWNS only what had no home. So
 * magnify_items/workstreams/metrics are read from their own tables, while
 * callings, quarterly interviews and standard work are read live from where
 * they already live. Steward's tables are never touched directly — its RLS is
 * self-only and a direct read silently returns a single row, which looks like
 * a bug rather than a permission error.
 */
export function useDashboardData(): DashboardData {
  const { user, profile, loading: authLoading, isPresidency, isClerk } = useAuth();
  const { demoMode } = useDemoMode();
  // Three ways to be in demo: the in-app toggle, the App Review account, and
  // the DB's own `is_demo` flag — the same flag `is_demo_user()` checks in RLS.
  // The third matters because the demo account can turn the toggle off, and
  // without it the client would ask for real data that RLS then partly serves
  // (anything not covered by a demo_block policy, like the stake's name).
  const isDemo = demoMode || isReviewDemoUser(profile?.email) || profile?.is_demo === true;
  const isAdmin = isPresidency || isClerk;
  const [loading, setLoading] = useState(true);
  // Guards against a stale fetch finishing last and overwriting newer state.
  const runId = useRef(0);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [pending, setPending] = useState<DashboardItem[]>([]);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [interviews, setInterviews] = useState<DashInterview[]>([]);
  const [standardWork, setStandardWork] = useState<StandardWorkRow[]>([]);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [metricDefs, setMetricDefs] = useState<MetricDef[]>([]);
  const [callingStageCounts, setCallingStageCounts] = useState<Record<string, number>>({});
  const [wards, setWards] = useState<WardRef[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [stakeName, setStakeName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadDemo = useCallback(() => {
    // The fixtures mark the stake president's own items with a sentinel owner
    // id. Rewrite it to whoever is actually signed in, or the "Mine" scope —
    // the dashboard's default view — comes up empty in the demo and the whole
    // screen looks broken.
    const me = user?.id ?? DEMO_ME;
    const own = (i: DashboardItem): DashboardItem =>
      i.owner_user_id === DEMO_ME ? { ...i, owner_user_id: me } : i;

    setItems(DEMO_ITEMS.filter(i => i.review_state === 'approved').map(own));
    setPending(DEMO_ITEMS.filter(i => i.review_state === 'pending_review').map(own));
    setWorkstreams(DEMO_WORKSTREAMS);
    setInterviews(DEMO_INTERVIEWS.map(iv =>
      iv.assigned_to_user_id === DEMO_ME ? { ...iv, assigned_to_user_id: me } : iv));
    setStandardWork(DEMO_STANDARD_WORK);
    setMetrics(DEMO_METRICS);
    setMetricDefs(DEMO_METRIC_DEFS);
    setCallingStageCounts(DEMO_CALLING_STAGE_COUNTS);
    setWards([]);
    setOwners([
      { userId: me, name: 'Pres. Shurtliff', calling: 'Stake President' },
      { userId: null, name: 'Pres. Kimball', calling: '1st Counselor' },
      { userId: null, name: 'Br. Whitfield', calling: 'High Council' },
      { userId: null, name: 'Br. Oduya', calling: 'High Council' },
      { userId: null, name: 'Br. Lindquist', calling: 'High Council' },
    ]);
    setOwnerNames({ [me]: 'Pres. Shurtliff' });
    setStakeName('Sample Stake');
    setLastSyncedAt(new Date().toISOString());
    setLoading(false);
  }, [user?.id]);

  const refresh = useCallback(async () => {
    const myRun = ++runId.current;

    // Wait for the profile before deciding anything. `user` lands one tick
    // before `profile`, so without this the hook briefly looks like a
    // non-demo signed-in user and fires the real queries — and that in-flight
    // fetch then resolves AFTER loadDemo() and overwrites the fixtures with
    // real data. That is how the App Review account ended up showing the
    // stake's real name (caught 2026-08-31).
    if (authLoading) return;

    if (isDemo) { loadDemo(); return; }
    if (!user?.id) { setLoading(false); return; }

    const { year, quarter } = currentQuarter();

    const [
      itemsRes, wsRes, interviewsRes, swRes, metricsRes, defsRes,
      callingsRes, wardsRes, profilesRes, spRes, hcRes, stakeRes,
    ] = await Promise.all([
      supabase.from('magnify_items').select('*'),
      supabase.from('magnify_workstreams').select('*').eq('status', 'active').order('sort_order'),
      supabase.rpc('magnify_dash_interviews', { p_year: year, p_quarter: quarter }),
      supabase.rpc('magnify_dash_my_standard_work'),
      // Metrics are presidency-only at the RLS layer; skip the round trip for
      // a high councilor rather than firing a query that returns nothing.
      isAdmin ? supabase.from('magnify_metrics').select('*').order('period_start') : Promise.resolve({ data: [] as MetricPoint[] }),
      supabase.from('magnify_metric_defs').select('*').order('sort_order'),
      supabase.from('callings').select('stage').eq('rejected', false).neq('stage', 'complete'),
      supabase.from('wards').select('id, name, abbreviation').order('sort_order'),
      supabase.from('profiles').select('id, full_name').eq('app', 'magnify').eq('status', 'approved'),
      supabase.from('sp_members').select('name, role').eq('active', true).order('sort_order'),
      supabase.from('high_council_members').select('name, user_id').eq('active', true).order('sort_order'),
      // RLS on `stakes` already narrows this to the caller's own stake.
      supabase.from('stakes').select('name').limit(1).maybeSingle(),
    ]);

    // A newer refresh started while this one was in flight — drop the result.
    if (myRun !== runId.current) return;

    const allItems = (itemsRes.data ?? []) as DashboardItem[];
    setItems(allItems.filter(i => i.review_state === 'approved'));
    setPending(allItems.filter(i => i.review_state === 'pending_review'));
    setWorkstreams((wsRes.data ?? []) as Workstream[]);
    setInterviews((interviewsRes.data ?? []) as DashInterview[]);
    setStandardWork((swRes.data ?? []) as StandardWorkRow[]);

    const metricRows = (metricsRes.data ?? []) as MetricPoint[];
    setMetrics(metricRows);
    setMetricDefs((defsRes.data ?? []) as MetricDef[]);

    const counts: Record<string, number> = {};
    for (const row of (callingsRes.data ?? []) as Array<{ stage: string }>) {
      counts[row.stage] = (counts[row.stage] ?? 0) + 1;
    }
    setCallingStageCounts(counts);
    setWards((wardsRes.data ?? []) as WardRef[]);
    setStakeName(((stakeRes as { data?: { name?: string } | null }).data?.name) ?? null);

    const names: Record<string, string> = {};
    for (const p of (profilesRes.data ?? []) as Array<{ id: string; full_name: string }>) {
      names[p.id] = p.full_name;
    }
    setOwnerNames(names);

    // Owner picker: presidency members and high councilors, with an account
    // link where one exists. Leaders without a Magnify account are still
    // pickable — they land in owner_label instead of owner_user_id.
    const hcRows = (hcRes.data ?? []) as Array<{ name: string; user_id: string | null }>;
    const spRows = (spRes.data ?? []) as Array<{ name: string; role: string }>;
    const nameToId: Record<string, string> = {};
    for (const [id, n] of Object.entries(names)) nameToId[n] = id;
    setOwners([
      ...spRows.map(r => ({ userId: nameToId[r.name] ?? null, name: r.name, calling: r.role })),
      ...hcRows.map(r => ({ userId: r.user_id ?? nameToId[r.name] ?? null, name: r.name, calling: 'high_council' })),
    ]);

    // Most recent LCR sync across items and metrics. Shown in the header so a
    // stale tile is visibly stale rather than quietly wrong.
    const syncStamps = [
      ...metricRows.map(m => m.synced_at),
      ...allItems.filter(i => i.source === 'lcr_sync').map(i => i.updated_at),
    ].filter(Boolean).sort();
    setLastSyncedAt(syncStamps.length ? syncStamps[syncStamps.length - 1] : null);

    setLoading(false);
  }, [isDemo, loadDemo, user?.id, isAdmin, authLoading]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createItem = useCallback(async (patch: Partial<DashboardItem>) => {
    if (isDemo) return;
    // stake_id, created_by and the defaults come from the table definition —
    // don't send them from the client, or a service-role convention and a
    // client convention start to disagree about which stake owns a row.
    const { data: rows } = await supabase
      .from('magnify_items')
      .insert({
        kind: patch.kind ?? 'action',
        title: patch.title ?? '',
        detail: patch.detail ?? null,
        owner_user_id: patch.owner_user_id ?? user?.id ?? null,
        owner_label: patch.owner_label ?? null,
        due_on: patch.due_on ?? null,
        workstream_id: patch.workstream_id ?? null,
      })
      .select();
    const created = (rows ?? [])[0] as DashboardItem | undefined;
    if (created) setItems(prev => [...prev, created]);
  }, [isDemo, user?.id]);

  const createWorkstream = useCallback(async (name: string, targetDate: string | null) => {
    if (isDemo) return;
    const { data: rows } = await supabase
      .from('magnify_workstreams')
      .insert({ name, target_date: targetDate })
      .select();
    const created = (rows ?? [])[0] as Workstream | undefined;
    if (created) setWorkstreams(prev => [...prev, created]);
  }, [isDemo]);

  const setItemStatus = useCallback(async (id: string, done: boolean) => {
    // Optimistic: flip the status in place rather than removing the row, so
    // UNDO is a second flip and the workstream tick counts move both ways.
    const completed_at = done ? new Date().toISOString() : null;
    const status: DashboardItem['status'] = done ? 'done' : 'open';
    setItems(prev => prev.map(i => (i.id === id ? { ...i, status, completed_at } : i)));
    if (isDemo) return;
    await supabase.from('magnify_items').update({ status, completed_at }).eq('id', id);
  }, [isDemo]);

  const updateItem = useCallback(async (id: string, patch: Partial<DashboardItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    if (isDemo) return;
    await supabase.from('magnify_items').update(patch).eq('id', id);
  }, [isDemo]);

  const approvePending = useCallback(async (id: string) => {
    const row = pending.find(p => p.id === id);
    setPending(prev => prev.filter(p => p.id !== id));
    if (row) setItems(prev => [...prev, { ...row, review_state: 'approved' }]);
    if (isDemo) return;
    await supabase.from('magnify_items').update({ review_state: 'approved' }).eq('id', id);
  }, [isDemo, pending]);

  const discardPending = useCallback(async (id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    if (isDemo) return;
    await supabase.from('magnify_items').delete().eq('id', id);
  }, [isDemo]);

  const setStandardWorkDone = useCallback(async (behaviorId: string, done: boolean) => {
    setStandardWork(prev =>
      prev.map(r => (r.id === behaviorId ? { ...r, value: done ? 'y' : 'n' } : r)));
    if (isDemo) return;
    // Goes through the RPC so a shared behavior fans out to every participant's
    // Steward row. Never write steward_entries from here directly.
    await supabase.rpc('magnify_dash_set_standard_work', {
      p_behavior_id: behaviorId,
      p_done: done,
    });
  }, [isDemo]);

  const wardCount = useMemo(
    () => (isDemo ? DEMO_WARD_COUNT : wards.length),
    [isDemo, wards.length],
  );

  return {
    loading, items, pending, workstreams, interviews, standardWork,
    metrics, metricDefs, callingStageCounts, wards, wardCount,
    owners, ownerNames, stakeName, lastSyncedAt,
    refresh, createItem, createWorkstream, setItemStatus, updateItem,
    approvePending, discardPending, setStandardWorkDone,
  };
}
