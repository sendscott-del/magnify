import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useDemoMode, isReviewDemoUser } from '../../context/DemoModeContext';
import { useActionCounts } from '../../context/ActionCountsContext';
import { getDemoActiveCallings, getDemoRejectedCallings } from '../../lib/demoCallings';
import { Calling, CallingType } from '../../lib/database.types';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';

const ACTIVE_STAGES = ['ideas', 'for_approval', 'stake_approved'];

export function PresidencyKanbanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile, isPresidency, isClerk } = useAuth();
  const { t } = useLanguage();
  const { demoMode } = useDemoMode();
  const { refresh: refreshActionCounts } = useActionCounts();
  const isDesktopWeb = useIsDesktopWeb();

  const ACTIVE_COLUMNS = [
    { stage: 'ideas', label: t('stage.ideas'), color: Colors.stage.ideas },
    { stage: 'for_approval', label: t('stage.for_approval'), color: Colors.stage.for_approval },
    { stage: 'stake_approved', label: t('stage.stake_approved'), color: Colors.stage.stake_approved },
  ];

  const TYPE_FILTERS: { label: string; value: CallingType | 'all' }[] = [
    { label: t('spBoard.filterAll'), value: 'all' },
    { label: t('type.ward_calling_short'), value: 'ward_calling' },
    { label: t('type.stake_calling_short'), value: 'stake_calling' },
    { label: t('type.mp_ordination_short'), value: 'mp_ordination' },
  ];
  const [callings, setCallings] = useState<Calling[]>([]);
  const [rejectedCallings, setRejectedCallings] = useState<Calling[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CallingType | 'all'>('all');
  const [mineOnly, setMineOnly] = useState(false);

  const canSeeRejected = profile?.role === 'stake_president';

  // "Just mine" matches the SP badge logic: cards in for_approval (role-gated)
  // or cards where my name is in extend / sustain / set_apart / record_by.
  const myName = profile?.full_name ?? null;
  const canFilterMine = !!myName && (isPresidency || isClerk);
  const isMine = useCallback((c: Calling) => {
    if (!myName) return false;
    if (c.stage === 'for_approval' && (isPresidency || isClerk)) return true;
    return [c.extend_by, c.sustain_by, c.set_apart_by, c.record_by].includes(myName);
  }, [myName, isPresidency, isClerk]);

  const visibleCallings = useMemo(() =>
    mineOnly ? callings.filter(isMine) : callings,
    [mineOnly, callings, isMine]);
  const visibleRejected = useMemo(() =>
    mineOnly ? rejectedCallings.filter(isMine) : rejectedCallings,
    [mineOnly, rejectedCallings, isMine]);

  const fetchCallings = useCallback(async () => {
    if (demoMode || isReviewDemoUser(profile?.email)) {
      // Demo: short-circuit all reads to fixture callings. No DB writes
      // happen from this screen, so no further demo-mode branching is
      // needed — drag-to-advance / detail-page actions still flow through
      // their own handlers, which can be guarded individually as needed.
      const all = getDemoActiveCallings();
      setCallings(typeFilter === 'all' ? all : all.filter(c => (c as unknown as { type: string }).type === typeFilter));
      if (canSeeRejected) {
        const rej = getDemoRejectedCallings();
        setRejectedCallings(typeFilter === 'all' ? rej : rej.filter(c => (c as unknown as { type: string }).type === typeFilter));
      } else {
        setRejectedCallings([]);
      }
      setViewedIds(new Set());
      return;
    }
    let q = supabase
      .from('callings')
      .select('*, wards!callings_ward_id_fkey(id,name,abbreviation)')
      .in('stage', ACTIVE_STAGES)
      .eq('rejected', false)
      .order('created_at', { ascending: false });
    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    const { data } = await q;
    setCallings((data as Calling[]) ?? []);

    if (canSeeRejected) {
      let rq = supabase
        .from('callings')
        .select('*, wards!callings_ward_id_fkey(id,name,abbreviation)')
        .eq('rejected', true)
        .neq('stage', 'complete')
        .order('created_at', { ascending: false });
      if (typeFilter !== 'all') rq = rq.eq('type', typeFilter);
      const { data: rd } = await rq;
      setRejectedCallings((rd as Calling[]) ?? []);
    }

    // Fetch which callings this user has viewed
    if (profile?.id) {
      const { data: views } = await supabase
        .from('calling_views')
        .select('calling_id')
        .eq('user_id', profile.id);
      if (views) {
        setViewedIds(new Set(views.map((v: any) => v.calling_id)));
      }
    }

    refreshActionCounts();
  }, [typeFilter, canSeeRejected, profile?.id, demoMode, refreshActionCounts]);

  useFocusEffect(
    useCallback(() => {
      fetchCallings();
    }, [fetchCallings])
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchCallings();
    setRefreshing(false);
  }

  function openCard(c: Calling) {
    // Demo cards now route to the actual detail screen — it loads the
    // fixture and short-circuits mutations to keep the real DB clean.
    navigation.navigate('CallingDetail', { callingId: c.id });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('spBoard.title')}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {TYPE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filter, typeFilter === f.value && styles.filterActive]}
            onPress={() => setTypeFilter(f.value)}
          >
            <Text style={[styles.filterText, typeFilter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        {canFilterMine && (
          <TouchableOpacity
            style={[styles.filter, mineOnly && styles.filterActive]}
            onPress={() => setMineOnly(v => !v)}
          >
            <Text style={[styles.filterText, mineOnly && styles.filterTextActive]}>
              {t('hcBoard.justMine')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {isDesktopWeb ? (
        // Desktop web: CSS Grid lays the columns out side-by-side. auto-fit
        // wraps to a second row at narrower widths so a 1024px iPad-width
        // browser still gets multi-row instead of a horizontal-scroll strip.
        <ScrollView
          style={styles.board}
          contentContainerStyle={styles.boardContentDesktop}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={kanbanGridStyle as any}>
            {ACTIVE_COLUMNS.map(col => (
              <KanbanColumn
                key={col.stage}
                title={col.label}
                color={col.color}
                callings={visibleCallings.filter(c => c.stage === col.stage)}
                viewedIds={viewedIds}
                onCardPress={openCard}
                fluid
              />
            ))}
            {canSeeRejected && (
              <KanbanColumn
                title={t('detail.declined')}
                color={Colors.error}
                callings={visibleRejected}
                viewedIds={viewedIds}
                onCardPress={openCard}
                fluid
              />
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {ACTIVE_COLUMNS.map(col => (
            <KanbanColumn
              key={col.stage}
              title={col.label}
              color={col.color}
              callings={visibleCallings.filter(c => c.stage === col.stage)}
              viewedIds={viewedIds}
              onCardPress={openCard}
            />
          ))}
          {canSeeRejected && (
            <KanbanColumn
              title={t('detail.declined')}
              color={Colors.error}
              callings={visibleRejected}
              viewedIds={viewedIds}
              onCardPress={openCard}
            />
          )}
        </ScrollView>
      )}
      <DisclaimerFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  filterRow: {
    maxHeight: 44, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  filterContent: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    gap: Spacing.xs, flexDirection: 'row',
  },
  filter: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  filterActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  filterText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  filterTextActive: { color: Colors.primary, fontWeight: '700' },
  board: { flex: 1 },
  boardContent: { padding: Spacing.md, flexDirection: 'row', alignItems: 'stretch' },
  boardContentDesktop: { padding: Spacing.md },
});

// CSS Grid for the desktop-web kanban. react-native-web passes through
// `display: 'grid'` and `gridTemplateColumns`; native ignores both (and we
// never render this path on native). minmax(220px, 1fr) means columns stay
// at least 220px wide and the whole row fills the available width.
const kanbanGridStyle = {
  display: 'grid' as const,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: Spacing.sm + 2,
  alignItems: 'stretch' as const,
};
