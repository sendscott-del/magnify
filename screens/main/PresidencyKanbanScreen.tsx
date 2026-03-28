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

const PRESIDENCY_COLUMNS = [
  { stage: 'ideas', label: 'Ideas', color: Colors.stage.ideas },
  { stage: 'for_approval', label: 'For Approval', color: Colors.stage.for_approval },
  { stage: 'stake_approved', label: 'Approved', color: Colors.stage.stake_approved },
];

const TYPE_FILTERS: { label: string; value: CallingType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Ward', value: 'ward_calling' },
  { label: 'Stake', value: 'stake_calling' },
  { label: 'MP', value: 'mp_ordination' },
];

export function PresidencyKanbanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [callings, setCallings] = useState<Calling[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CallingType | 'all'>('all');

  const fetchCallings = useCallback(async () => {
    let q = supabase
      .from('callings')
      .select('*, wards(id,name,abbreviation)')
      .in('stage', ['ideas', 'for_approval', 'stake_approved'])
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

  const columnCallings = (stage: string) => callings.filter(c => c.stage === stage);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stake Presidency</Text>
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
        {PRESIDENCY_COLUMNS.map(col => (
          <KanbanColumn
            key={col.stage}
            title={col.label}
            color={col.color}
            callings={columnCallings(col.stage)}
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
