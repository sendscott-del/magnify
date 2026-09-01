import React, { useCallback, useMemo, useState } from 'react';
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
import {
  DashboardItem, ZONE1_MAX_ROWS, byDueDate, duePill, formatMonthDay, isUrgent,
} from '../../lib/dashboard';
import {
  Scope, highCouncilTiles, isOpen, presidencyTiles, scopeItems, workstreamSpecs,
} from '../../lib/dashboardTiles';
import { MetricCard, StatTile, WorkstreamCard } from '../../components/dashboard/cards';
import { Grid } from '../../components/dashboard/Grid';
import { NeedsYouRow } from '../../components/dashboard/NeedsYouRow';
import { ItemSheet } from '../../components/dashboard/ItemSheet';
import { Toast } from '../../components/dashboard/Toast';
import { NewWorkstreamSheet } from '../../components/dashboard/NewWorkstreamSheet';
import { CalmEmpty, Segmented, SectionHeader } from '../../components/dashboard/primitives';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { buildMetricSpecs } from '../../lib/dashboardMetrics';

/**
 * The Dashboard — Magnify's home screen.
 *
 * Three zones, stacked, always in this order: Needs you → The stake right now
 * → Workstreams. Not tabs and not a merged feed, because the question a
 * presidency member opens this with ("what is blocked on me?") has to be
 * answerable without a single tap.
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
  const { hcCount } = useActionCounts();
  const isDesktopWeb = useIsDesktopWeb();
  const data = useDashboard();

  const [scope, setScope] = useState<Scope>('mine');
  const [openItem, setOpenItem] = useState<DashboardItem | null>(null);
  const [draftItem, setDraftItem] = useState<DashboardItem | null>(null);
  const [newWorkstream, setNewWorkstream] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  const isAdmin = isPresidency || isClerk;
  const myId = user?.id ?? null;
  const myName = profile?.full_name ?? null;

  const openItems = useMemo(() => data.items.filter(isOpen), [data.items]);
  const scoped = useMemo(
    () => scopeItems(openItems, scope, myId, myName),
    [openItems, scope, myId, myName],
  );

  // Zone 1: overdue first, then due within a week, hard-capped. Anything
  // further out belongs in a tile, not in the urgent list.
  const urgent = useMemo(
    () => scoped.filter(isUrgent).sort(byDueDate),
    [scoped],
  );
  const zone1 = urgent.slice(0, ZONE1_MAX_ROWS);
  const overflowCount = scoped.length - zone1.length;
  const nextDue = useMemo(
    () => scoped.filter(i => i.due_on).sort(byDueDate)[0]?.due_on ?? null,
    [scoped],
  );

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
      t, language,
    };
    return isAdmin ? presidencyTiles(input) : highCouncilTiles(input);
  }, [scoped, data.interviews, data.standardWork, data.callingStageCounts,
      data.wards, data.wardCount, myId, myName, hcCount, isAdmin, t, language]);

  const workstreams = useMemo(
    () => workstreamSpecs(data.workstreams, data.items, language),
    [data.workstreams, data.items, language],
  );

  const metricSpecs = useMemo(
    () => buildMetricSpecs(data.metrics, data.metricDefs, language, t('dash.metrics.target')),
    [data.metrics, data.metricDefs, language, t],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await data.refresh();
    setRefreshing(false);
  }, [data]);

  function markDone(item: DashboardItem) {
    void data.setItemStatus(item.id, true);
    setToast({
      message: t('dash.toast.markedDone'),
      undo: () => { void data.setItemStatus(item.id, false); setToast(null); },
    });
  }

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
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: t('dash.scope.mine') },
                { value: 'everyone', label: t('dash.scope.everyone') },
              ]}
            />
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
        {isAdmin && data.pending.length > 0 && (
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

        {/* Zone 1 */}
        <View style={styles.zone}>
          <SectionHeader
            title={t('dash.zone1.title')}
            note={scope === 'mine' ? t('dash.zone1.justMine') : t('dash.zone1.wholePresidency')}
          />
          {zone1.length === 0 ? (
            <CalmEmpty
              title={t('dash.zone1.emptyTitle')}
              sub={nextDue
                ? `${t('dash.zone1.emptySub')} ${formatMonthDay(nextDue, language)}.`
                : undefined}
            />
          ) : (
            <View style={{ gap: 8 }}>
              {zone1.map(item => (
                <NeedsYouRow
                  key={item.id}
                  item={item}
                  eyebrow={t(`dash.kind.${item.kind}` as TranslationKey)}
                  pill={duePill(item.due_on, t, language)}
                  ownerLabel={scope === 'everyone'
                    ? (item.owner_label
                       ?? (item.owner_user_id ? data.ownerNames[item.owner_user_id] : null))
                    : null}
                  onPress={() => setOpenItem(item)}
                  onDone={() => markDone(item)}
                  doneAccessibilityLabel={t('dash.a11y.markDone')}
                />
              ))}
            </View>
          )}
          {overflowCount > 0 && (
            <Text style={styles.overflow}>
              + {overflowCount} {t('dash.zone1.moreNoneUrgent')}
            </Text>
          )}
        </View>

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
        item={openItem}
        visible={!!openItem}
        owners={data.owners}
        workstreams={data.workstreams}
        ownerNames={data.ownerNames}
        language={language}
        t={t}
        onClose={() => setOpenItem(null)}
        onSave={patch => {
          if (openItem) void data.updateItem(openItem.id, patch);
          setToast({ message: t('dash.toast.saved') });
        }}
        onToggleDone={done => {
          if (!openItem) return;
          void data.setItemStatus(openItem.id, done);
          setToast({
            message: done ? t('dash.toast.markedDone') : t('dash.toast.reopened'),
            undo: done
              ? () => { void data.setItemStatus(openItem.id, false); setToast(null); }
              : undefined,
          });
        }}
      />

      <ItemSheet
        item={draftItem}
        visible={!!draftItem}
        createMode
        owners={data.owners}
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
  overflow: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
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
