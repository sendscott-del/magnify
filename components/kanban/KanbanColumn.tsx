import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';
import { CallingCard } from './CallingCard';
import { Calling } from '../../lib/database.types';
import { EmptyState } from '../ui/EmptyState';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  title: string;
  callings: Calling[];
  onCardPress: (calling: Calling) => void;
  color?: string;
  headerAction?: React.ReactNode;
  viewedIds?: Set<string>;
  /** Desktop-web CSS Grid lays out the column widths from the outside, so
   *  the column itself should fill its grid cell instead of declaring a fixed
   *  280px width + horizontal margin (those overflow the cell on a 1280px
   *  monitor with 8 columns, which is why Sustain spilled into Set Apart in
   *  v2.24.0). Native horizontal-scroll mode keeps the original behavior. */
  fluid?: boolean;
}

export function KanbanColumn({ title, callings, onCardPress, color = Colors.primary, headerAction, viewedIds, fluid }: Props) {
  const { t } = useLanguage();
  return (
    <View style={[styles.column, fluid && styles.columnFluid]}>
      <View style={[styles.header, { borderTopColor: color }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{callings.length}</Text>
        </View>
      </View>
      {headerAction && <View style={styles.headerActionRow}>{headerAction}</View>}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {callings.length === 0 ? (
          <EmptyState icon="list-outline" title={t('hcBoard.nothingHere')} />
        ) : (
          callings.map(c => (
            <CallingCard key={c.id} calling={c} onPress={() => onCardPress(c)} isNew={viewedIds ? !viewedIds.has(c.id) : false} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: 280,
    marginRight: Spacing.md,
    flex: 1,
  },
  columnFluid: {
    width: 'auto',
    minWidth: 0,
    marginRight: 0,
    flex: 1,
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 3,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[800],
  },
  badge: {
    borderRadius: Radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  headerActionRow: {
    marginBottom: Spacing.sm,
  },
  scroll: {
    flex: 1,
  },
});
