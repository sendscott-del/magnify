import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Calling, Ward } from '../../lib/database.types';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

const TYPE_COLORS: Record<string, string> = {
  ward_calling: Colors.type.ward,
  stake_calling: Colors.type.stake,
  mp_ordination: Colors.type.mp,
};

export function CompletedCallingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const TYPE_LABELS: Record<string, string> = {
    ward_calling: t('type.ward_calling_short'),
    stake_calling: t('type.stake_calling_short'),
    mp_ordination: t('type.mp_ordination_short'),
  };

  const [callings, setCallings] = useState<Calling[]>([]);
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [wardFilterName, setWardFilterName] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [showWardPicker, setShowWardPicker] = useState(false);

  const fetchCallings = useCallback(async () => {
    const { data } = await supabase
      .from('callings')
      .select('*, wards!callings_ward_id_fkey(id,name,abbreviation,sort_order)')
      .eq('stage', 'complete')
      .order('completed_at', { ascending: false });
    setCallings((data as Calling[]) ?? []);
  }, []);

  const fetchWards = useCallback(async () => {
    const { data } = await supabase.from('wards').select('*').order('sort_order');
    setWards((data as Ward[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCallings();
      fetchWards();
    }, [fetchCallings, fetchWards])
  );

  const filtered = callings.filter(c => {
    const matchesSearch =
      !search ||
      c.member_name.toLowerCase().includes(search.toLowerCase()) ||
      c.calling_name.toLowerCase().includes(search.toLowerCase());
    const matchesWard = !wardFilter || c.ward_id === wardFilter;
    return matchesSearch && matchesWard;
  });

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('completed.title')}</Text>
        <Text style={styles.subtitle}>{filtered.length} {t('completed.callings')}</Text>
      </View>

      {/* Search + Filter */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={16} color={Colors.gray[400]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('completed.searchPlaceholder')}
            placeholderTextColor={Colors.gray[400]}
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              accessibilityLabel={t('common.clearSearch')}
              accessibilityRole="button"
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Ionicons name="close-circle" size={16} color={Colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.wardFilterBtn}
          onPress={() => setShowWardPicker(true)}
        >
          <Text style={styles.wardFilterText} numberOfLines={1}>
            {wardFilterName || t('completed.filterAll')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.gray[500]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            title={t('completed.empty')}
            subtitle={t('completed.emptySubtitle')}
          />
        }
        ListFooterComponent={<DisclaimerFooter />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('CallingDetail', { callingId: item.id })}
            activeOpacity={0.8}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowName} numberOfLines={1}>{item.member_name}</Text>
              <Text style={styles.rowCalling} numberOfLines={1}>{item.calling_name}</Text>
              <View style={styles.rowFooter}>
                <Text style={styles.rowWard}>{item.wards?.abbreviation}</Text>
                <Text style={styles.rowDate}>{formatDate(item.completed_at)}</Text>
              </View>
            </View>
            <View style={styles.rowBadge}>
              <Badge label={TYPE_LABELS[item.type]} color={TYPE_COLORS[item.type]} />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Ward Filter Modal */}
      <Modal
        visible={showWardPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWardPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWardPicker(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('completed.filterByWard')}</Text>
            <TouchableOpacity
              style={[styles.modalItem, !wardFilter && styles.modalItemSelected]}
              onPress={() => {
                setWardFilter('');
                setWardFilterName('');
                setShowWardPicker(false);
              }}
            >
              <Text style={[styles.modalItemText, !wardFilter && styles.modalItemTextSelected]}>
                {t('completed.filterAll')}
              </Text>
            </TouchableOpacity>
            {wards.map(ward => (
              <TouchableOpacity
                key={ward.id}
                style={[styles.modalItem, wardFilter === ward.id && styles.modalItemSelected]}
                onPress={() => {
                  setWardFilter(ward.id);
                  setWardFilterName(ward.name);
                  setShowWardPicker(false);
                }}
              >
                <Text style={[
                  styles.modalItemText,
                  wardFilter === ward.id && styles.modalItemTextSelected,
                ]}>
                  {ward.name}
                </Text>
                <Text style={styles.modalItemAbbr}>{ward.abbreviation}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[400], marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.black,
    paddingVertical: 2,
  },
  wardFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
    maxWidth: 120,
    gap: 4,
  },
  wardFilterText: {
    fontSize: FontSize.xs,
    color: Colors.gray[600],
    fontWeight: '600',
    flexShrink: 1,
  },
  listContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  rowMain: { flex: 1, marginRight: Spacing.sm },
  rowName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 2,
  },
  rowCalling: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    marginBottom: Spacing.xs,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowWard: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    fontWeight: '600',
  },
  rowDate: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
  },
  rowBadge: { flexShrink: 0 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '60%',
    paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemAbbr: { fontSize: FontSize.sm, color: Colors.gray[400], fontWeight: '600' },
});
