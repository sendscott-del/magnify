import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useActionCounts } from '../../context/ActionCountsContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import { useDashboard } from '../../context/DashboardContext';
import { DashboardItem, formatMonthDay } from '../../lib/dashboard';
import {
  Scope, highCouncilTiles, isOpen, presidencyTiles, scopeItems, workstreamSpecs,
} from '../../lib/dashboardTiles';
import { MetricCard, StatTile, WorkstreamCard } from '../../components/dashboard/cards';
import { Grid } from '../../components/dashboard/Grid';
import { ItemSheet } from '../../components/dashboard/ItemSheet';
import { Toast } from '../../components/dashboard/Toast';
import { NewWorkstreamSheet } from '../../components/dashboard/NewWorkstreamSheet';
import { CalmEmpty, Segmented, SectionHeader } from '../../components/dashboard/primitives';
import { ThisSundayCard, SundayLayout } from '../../components/dashboard/ThisSundayCard';
import { SlackReminderSheet, TextReminderSheet } from '../../components/dashboard/ReminderSheets';
import { useSunday, loadReminderWebhooks, logReminder } from '../../lib/scheduleData';
import {
  ReminderSent, bodiesForRole, buildTimeline, formatSundayLong, isCardWindow, seatForRole,
  slackReminders, textReminder,
} from '../../lib/schedule';
import { postToWebhook } from '../../lib/slack';
import { supabase } from '../../lib/supabase';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { buildMetricSpecs } from '../../lib/dashboardMetrics';

/**
 * The Dashboard — Magnify's home screen.
 *
 * Two zones, stacked, always in this order: The stake right now → Workstreams.
 * Not tabs and not a merged feed. The tiles carry the counts; the list behind
 * each count is one tap away in the drill screen. There used to be a "Needs
 * you" list of urgent rows above the tiles; Scott removed it on 2026-09-13
 * because the tiles already answer the question and the list duplicated them.
 *
 * The same component renders phone and full-width desktop web. The only
 * difference is chrome supplied by the shell around it — WebShell provides the
 * navy sidebar, the tab navigator provides the tab bar — so nothing here
 * branches on platform except the toast's bottom offset.
 */
export function DashboardScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { profile, user, isPresidency, isClerk } = useAuth();
  const { t, language } = useLanguage();
  const { hcCount, spCount } = useActionCounts();
  const isDesktopWeb = useIsDesktopWeb();
  const data = useDashboard();

  // Four layouts (design review 2026-09-19): the president and clerks get
  // Mine / Everyone; a counselor gets Mine / High council (his own items plus
  // every high councilor's, never the president's); a high councilor or stake
  // council member sees only his own and never sees a switch.
  const role = profile?.role ?? '';
  const isCounselor = role === 'first_counselor' || role === 'second_counselor';
  const isStakeCouncil = role === 'stake_council';
  const layout: SundayLayout = role === 'stake_president' ? 'president'
    : isCounselor ? 'counselor' : isClerk ? 'clerk' : 'member';
  const scopeOptions: Array<{ value: Scope; label: string }> = isCounselor
    ? [{ value: 'mine', label: t('dash.scope.mine') }, { value: 'hc', label: t('dash.scope.highCouncil') }]
    : [{ value: 'mine', label: t('dash.scope.mine') }, { value: 'everyone', label: t('dash.scope.everyone') }];
  const canSeeEveryone = isPresidency || isClerk;
  const [scopeState, setScope] = useState<Scope>('mine');
  const scope: Scope = canSeeEveryone ? scopeState : 'mine';
  const sunday = useSunday();
  const [slackOpen, setSlackOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [sending, setSending] = useState(false);
  const [textCount, setTextCount] = useState<number | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [draftItem, setDraftItem] = useState<DashboardItem | null>(null);
  const [newWorkstream, setNewWorkstream] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  const isAdmin = isPresidency || isClerk;
  // A high councilor may only hand an item to another high councilor (the
  // reassign RPC enforces it); don't offer him names the database will refuse.
  const ownerChoices = useMemo(
    () => (isAdmin ? data.owners : data.owners.filter(o => o.calling === 'high_council')),
    [isAdmin, data.owners],
  );
  const myId = user?.id ?? null;
  const myName = profile?.full_name ?? null;

  const openItems = useMemo(() => data.items.filter(isOpen), [data.items]);
  const hcOwners = useMemo(() => ({
    ids: new Set(data.owners.filter(o => o.calling === 'high_council' && o.userId).map(o => o.userId as string)),
    names: new Set(data.owners.filter(o => o.calling === 'high_council').map(o => o.name)),
  }), [data.owners]);
  const scoped = useMemo(
    () => scopeItems(openItems, scope, myId, myName, hcOwners),
    [openItems, scope, myId, myName, hcOwners],
  );

  // ---- This Sunday -------------------------------------------------------
  const bodiesFor = useMemo(() => bodiesForRole(role), [role]);
  const seat = seatForRole(role);
  const myWardIds = useMemo(
    () => (seat ? sunday.bundle.assignments.filter(a => a.seat === seat).map(a => a.ward_id) : []),
    [seat, sunday.bundle.assignments],
  );
  const wardNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const w of sunday.reference.wards) out[w.id] = w.name;
    return out;
  }, [sunday.reference.wards]);
  const visibleMeetings = useMemo(
    () => sunday.bundle.meetings.filter(m => bodiesFor(m.body)),
    [sunday.bundle.meetings, bodiesFor],
  );
  const timeline = useMemo(() => buildTimeline({
    week: sunday.bundle.week,
    meetings: sunday.bundle.meetings,
    wardIds: myWardIds,
    wardNames,
    wardTimes: sunday.reference.wardTimes,
    buildings: sunday.reference.buildings,
    travel: sunday.reference.travel,
    settings: sunday.reference.settings,
    bodiesFor,
    calendarEvents: layout === 'member' ? [] : sunday.bundle.events,
    dismissedKeys: sunday.bundle.dismissedKeys,
    t,
  }), [sunday.bundle.week, sunday.bundle.meetings, sunday.bundle.events, sunday.bundle.dismissedKeys, myWardIds, wardNames, sunday.reference, bodiesFor, layout, t]);
  const isCompanion = !!sunday.bundle.rotation && sunday.reference.hcMembers.some(
    m => m.id === sunday.bundle.rotation?.hc_member_id && (m.user_id === myId || m.name === myName));
  const ownInterviewDate = useMemo(() => {
    if (layout !== 'member') return null;
    const iv = data.interviews.find(i => i.scheduled_for === sunday.sundayISO && !i.completed_at);
    return iv?.scheduled_for ?? null;
  }, [layout, data.interviews, sunday.sundayISO]);
  // Friday–Sunday, or any day the coming Sunday has an unresolved conflict.
  const showSunday = !sunday.loading && (isCardWindow() || (layout !== 'member' && timeline.conflicts.length > 0));
  const cardWeek = sunday.bundle.week ?? (sunday.bundle.events.length ? { id: '', sunday_on: sunday.sundayISO, kind: 'meetings' as const } : null);
  const canRemind = isPresidency || isClerk;
  const slackPosts = useMemo(
    () => slackReminders(sunday.sundayISO, sunday.bundle.meetings, sunday.reference.settings, t),
    [sunday.sundayISO, sunday.bundle.meetings, sunday.reference.settings, t],
  );
  const textPost = useMemo(() => textReminder(sunday.sundayISO, sunday.bundle.meetings, t), [sunday.sundayISO, sunday.bundle.meetings, t]);
  const slackAlready = sunday.bundle.reminders.some(r => r.channel === 'slack');
  const textAlready = sunday.bundle.reminders.some(r => r.channel === 'tidings');

  async function openSlack() {
    setWebhooks(await loadReminderWebhooks());
    setSlackOpen(true);
  }

  async function postSlack() {
    if (!sunday.bundle.week || slackAlready) return;
    setPosting(true);
    const sent: ReminderSent[] = [];
    for (const r of slackPosts) {
      const url = webhooks[r.eventType];
      if (!url) continue;
      await postToWebhook(url, r.body);
      const row = await logReminder({ week_id: sunday.bundle.week.id, channel: 'slack', target: r.eventType, body: r.body });
      if (row) sent.push(row);
    }
    setPosting(false);
    setSlackOpen(false);
    for (const row of sent) sunday.addReminder(row);
    setToast({ message: sent.length ? t('sunday.toastSlackPosted') : t('sunday.toastNothingPosted') });
  }

  async function callTextFn(preview: boolean): Promise<{ count?: number; error?: string; reminder?: ReminderSent }> {
    if (!sunday.bundle.week || !textPost) return { error: t('sunday.noTextMeetings') };
    const { data: res, error } = await supabase.functions.invoke('magnify-send-reminder-text', {
      body: { week_id: sunday.bundle.week.id, body: textPost.body, lists: textPost.lists, preview },
    });
    if (error) {
      // supabase-js surfaces non-2xx as a FunctionsHttpError with the body on context.
      let msg = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) { const j = await ctx.json(); if (j?.error) msg = j.error === 'already_sent' ? t('sunday.textAlreadySent') : j.error; }
      } catch { /* keep message */ }
      return { error: msg };
    }
    return res as { count?: number; reminder?: ReminderSent };
  }

  async function openText() {
    setTextCount(null);
    setTextError(null);
    setTextOpen(true);
    const res = await callTextFn(true);
    if (res.error) setTextError(res.error);
    setTextCount(res.count ?? 0);
  }

  async function sendText() {
    if (textAlready) return;
    setSending(true);
    const res = await callTextFn(false);
    setSending(false);
    if (res.error) { setTextError(res.error); return; }
    setTextOpen(false);
    if (res.reminder) sunday.addReminder(res.reminder);
    setToast({ message: `${t('sunday.toastTextSent')} ${res.count ?? ''}`.trim() });
  }


  const tiles = useMemo(() => {
    const input = {
      openItems: scoped,
      interviews: data.interviews,
      standardWork: data.standardWork,
      callingStageCounts: data.callingStageCounts,
      wards: data.wards,
      wardCount: data.wardCount,
      myId, myName,
      hcVoteCount: hcCount,
      spActionCount: spCount,
      callingTotal: Object.values(data.callingStageCounts).reduce((a, b) => a + b, 0),
      scope,
      t, language,
    };
    return isAdmin
      ? presidencyTiles(input)
      : highCouncilTiles(input, { showBoard: !isStakeCouncil, showInterview: !isStakeCouncil });
  }, [scoped, data.interviews, data.standardWork, data.callingStageCounts,
      data.wards, data.wardCount, myId, myName, hcCount, spCount, scope, isAdmin, isStakeCouncil, t, language]);

  const workstreams = useMemo(
    () => workstreamSpecs(data.workstreams, data.items, language),
    [data.workstreams, data.items, language],
  );

  const metricSpecs = useMemo(
    () => buildMetricSpecs(data.metrics, data.metricDefs, language, t('dash.metrics.target')),
    [data.metrics, data.metricDefs, language, t],
  );

  // A failed write is a toast, not silence. Silence is how a broken policy
  // went unnoticed for two weeks while the UI kept saying "Saved".
  useEffect(() => {
    if (!data.lastError) return;
    setToast({ message: data.lastError });
    data.clearError();
  }, [data.lastError, data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await data.refresh();
    setRefreshing(false);
  }, [data]);

  /** A blank in-memory item the sheet edits; the row is only written on Save. */
  function startNewItem() {
    setDraftItem({
      id: '__new__',
      stake_id: '',
      kind: 'action',
      title: '',
      detail: null,
      status: 'open',
      owner_user_id: myId,
      owner_label: null,
      due_on: null,
      workstream_id: null,
      source: 'manual',
      source_ref: {},
      review_state: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });
  }

  function goDrill(drill: string, title: string) {
    // The scope travels with the drill. A tile that counted "Mine" opening a
    // list of everyone's items is the one thing that would make the numbers
    // untrustworthy — the tile and the list behind it must be the same query.
    nav.navigate('DashboardDrill', { drill, title, scope });
  }

  function onTilePress(key: string, drill: string | undefined, label: string) {
    // The callings tiles have no drill list on purpose — they report on the
    // kanban, so they open the board that actually owns the data.
    if (key === 'calling') { nav.navigate(isAdmin ? 'PresidencyBoard' : 'HC'); return; }
    if (key === 'myVotes') { nav.navigate('HC'); return; }
    if (drill === 'standard') { nav.navigate('StandardWork'); return; }
    if (drill) goDrill(drill, label);
  }

  const roleTitle = profile?.role ? t(`role.${profile.role}` as TranslationKey) : '';
  const headerSub = [roleTitle, data.stakeName].filter(Boolean).join(' · ');

  if (data.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, !isDesktopWeb && { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('dash.title')}</Text>
          {!!headerSub && <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerControls}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={startNewItem}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('dash.edit.newTitle')}
            >
              <Ionicons name="add" size={20} color={Colors.primary} />
            </TouchableOpacity>
            {canSeeEveryone && (
              <Segmented value={scope} onChange={setScope} options={scopeOptions} />
            )}
          </View>
          {!!data.lastSyncedAt && (
            <View style={styles.syncRow}>
              <Ionicons name="cloud-done-outline" size={12} color={Colors.gray[400]} />
              <Text style={styles.syncText}>
                {t('dash.syncedAt')} {formatMonthDay(data.lastSyncedAt.slice(0, 10), language)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Zone 0 — nothing extracted from a meeting reaches the board until a
            human approves it here. Presidency only. */}
        {isPresidency && data.pending.length > 0 && (
          <TouchableOpacity
            style={styles.reviewBanner}
            onPress={() => nav.navigate('ReviewQueue')}
            activeOpacity={0.8}
          >
            <Ionicons name="mic-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewTitle}>
                {data.pending.length} {t('dash.review.waiting')}
              </Text>
              <Text style={styles.reviewSub} numberOfLines={1}>
                {reviewSources(data.pending)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {/* Zone 1 — This Sunday. Friday to Sunday, or whenever the coming
            Sunday has a conflict the presidency has not resolved. */}
        {showSunday && (
          <ThisSundayCard
            layout={layout}
            sundayISO={sunday.sundayISO}
            week={cardWeek}
            meetings={visibleMeetings}
            timeline={timeline}
            companion={layout === 'president' && sunday.bundle.rotation?.member_name
              ? { name: sunday.bundle.rotation.member_name, reason: sunday.bundle.rotation.reason }
              : null}
            isCompanion={isCompanion}
            ownInterviewDate={ownInterviewDate}
            reminders={sunday.bundle.reminders}
            canPostSlack={canRemind && !!sunday.bundle.week}
            canSendText={canRemind && !!textPost}
            canEdit={canRemind}
            onPostSlack={() => { void openSlack(); }}
            onSendText={() => { void openText(); }}
            onEdit={() => nav.navigate('ScheduleEdit', { sunday: sunday.sundayISO })}
            onClearConflict={key => { void sunday.clearConflict(key).then(e => e && setToast({ message: e })); }}
            onRestoreConflicts={() => { void sunday.restoreCleared().then(e => e && setToast({ message: e })); }}
            language={language}
            t={t}
          />
        )}

        {/* Zone 2 */}
        <View style={styles.zone}>
          <SectionHeader title={isAdmin ? t('dash.zone2.title') : t('dash.zone2.titleHc')} />
          <Grid minColumnWidth={158}>
            {tiles.map(tile => (
              <StatTile
                key={tile.key}
                tile={tile}
                onPress={() => onTilePress(tile.key, tile.drill, tile.label)}
              />
            ))}
          </Grid>
        </View>

        {/* Zone 3 */}
        {(workstreams.length > 0 || isAdmin) && (
          <View style={styles.zone}>
            <View style={styles.zone3Header}>
              <Text style={styles.sectionTitle}>{t('dash.zone3.title')}</Text>
              <View style={styles.zone3Right}>
                <Text style={styles.sectionNote}>
                  {`${workstreams.length} ${t('dash.zone3.active')}`}
                </Text>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => setNewWorkstream(true)}
                    activeOpacity={0.8}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('dash.workstream.newTitle')}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {workstreams.length === 0 && (
              <CalmEmpty
                title={t('dash.zone3.emptyTitle')}
                sub={t('dash.zone3.emptySub')}
                icon="layers-outline"
                tone="neutral"
              />
            )}
            <Grid minColumnWidth={250} minColumns={1}>
              {workstreams.map(ws => (
                <WorkstreamCard
                  key={ws.id}
                  ws={ws}
                  nextPrefix={t('dash.zone3.next')}
                  countLabel={`${ws.done} ${t('dash.unit.of')} ${ws.total} ${t('dash.unit.done')}`}
                  onPress={() => goDrill(`ws:${ws.id}`, ws.name)}
                />
              ))}
            </Grid>
          </View>
        )}

        {/* Quarterly metrics — presidency only, a strip and not a chart wall.
            Full history is a drill-down. */}
        {isAdmin && metricSpecs.length > 0 && (
          <View style={styles.zone}>
            <View style={styles.metricHeader}>
              <Text style={styles.sectionTitle}>{t('dash.metrics.title')}</Text>
              <TouchableOpacity onPress={() => nav.navigate('MetricsHistory')} activeOpacity={0.8}>
                <Text style={styles.historyLink}>{t('dash.metrics.history')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {metricSpecs.map(m => (
                <MetricCard key={m.key} metric={m} onPress={() => nav.navigate('MetricsHistory')} />
              ))}
            </ScrollView>
          </View>
        )}

        <DisclaimerFooter />
        <Text style={styles.confidential}>{t('dash.footer.confidential')}</Text>
      </ScrollView>

      <ItemSheet
        item={draftItem}
        visible={!!draftItem}
        createMode
        owners={ownerChoices}
        workstreams={data.workstreams}
        ownerNames={data.ownerNames}
        language={language}
        t={t}
        onClose={() => setDraftItem(null)}
        onSave={patch => {
          void data.createItem(patch);
          setToast({ message: t('dash.toast.created') });
        }}
        onToggleDone={() => {}}
      />

      <NewWorkstreamSheet
        visible={newWorkstream}
        language={language}
        t={t}
        onClose={() => setNewWorkstream(false)}
        onCreate={(name, target) => {
          void data.createWorkstream(name, target);
          setToast({ message: t('dash.toast.workstreamCreated') });
        }}
      />

      <SlackReminderSheet
        visible={slackOpen}
        sundayLabel={formatSundayLong(sunday.sundayISO, language)}
        reminders={slackPosts}
        webhooks={webhooks}
        alreadySent={slackAlready}
        posting={posting}
        onPost={() => { void postSlack(); }}
        onClose={() => setSlackOpen(false)}
        t={t}
      />
      <TextReminderSheet
        visible={textOpen}
        sundayLabel={formatSundayLong(sunday.sundayISO, language)}
        reminder={textPost}
        recipientCount={textCount}
        listSummary={textPost
          ? textPost.lists.map(l => t(l === 'hc' ? 'schedule.body.HC' : 'schedule.body.SC')).join(` ${t('sunday.and')} `) + ` ${t('sunday.for')}`
          : ''}
        alreadySent={textAlready}
        sending={sending}
        error={textError}
        onSend={() => { void sendText(); }}
        onClose={() => setTextOpen(false)}
        t={t}
      />

      {toast && (
        <Toast
          message={toast.message}
          undoLabel={toast.undo ? t('dash.toast.undo') : undefined}
          onUndo={toast.undo}
          onDismiss={() => setToast(null)}
          bottomOffset={isDesktopWeb ? 0 : 56}
        />
      )}
    </View>
  );
}

/** "Stake Presidency, High Council" — which meetings the queue came from. */
function reviewSources(pending: DashboardItem[]): string {
  const names = new Set<string>();
  for (const p of pending) {
    const m = (p.source_ref as { meeting?: string } | undefined)?.meeting;
    if (m) names.add(m);
  }
  return Array.from(names).join(', ');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 1,
  },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  zone3Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  zone3Right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionNote: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncText: { fontSize: 10, color: Colors.gray[400] },
  scroll: { padding: Spacing.md, gap: 20 },
  zone: { gap: 0 },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[800],
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryFade,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reviewTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  reviewSub: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 1 },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  historyLink: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  confidential: {
    fontSize: 10,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: -4,
    lineHeight: 14,
  },
});
