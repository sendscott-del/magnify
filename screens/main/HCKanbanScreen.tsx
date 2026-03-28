import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Calling, CallingType } from '../../lib/database.types';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const HC_COLUMNS = [
  { stages: ['hc_approval'], label: 'HC Approval', color: Colors.stage.hc_approval },
  { stages: ['issue_calling', 'ordained'], label: 'Issue / Ordain', color: Colors.stage.issue_calling },
  { stages: ['sustain'], label: 'Sustain', color: Colors.stage.sustain },
  { stages: ['set_apart'], label: 'Set Apart', color: Colors.stage.set_apart },
  { stages: ['record'], label: 'Record', color: Colors.stage.record },
];

const TYPE_FILTERS: { label: string; value: CallingType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Ward', value: 'ward_calling' },
  { label: 'Stake', value: 'stake_calling' },
  { label: 'MP', value: 'mp_ordination' },
];

export function HCKanbanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [callings, setCallings] = useState<Calling[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CallingType | 'all'>('all');

  const fetchCallings = useCallback(async () => {
    let q = supabase
      .from('callings')
      .select('*, wards(id,name,abbreviation)')
      .in('stage', ['hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record'])
      .order('created_at', { ascending: false });
    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    const { data } = await q;
    setCallings((data as Calling[]) ?? []);
  }, [typeFilter]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>High Council Board</Text>
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
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {HC_COLUMNS.map(col => (
          <KanbanColumn
            key={col.label}
            title={col.label}
            color={col.color}
            callings={callings.filter(c => col.stages.includes(c.stage))}
            onCardPress={(c) => navigation.navigate('CallingDetail', { callingId: c.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  filterRow: {
    maxHeight: 44,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  filterContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  filter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  filterActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFade,
  },
  filterText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  filterTextActive: { color: Colors.primary, fontWeight: '700' },
  board: { flex: 1 },
  boardContent: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
