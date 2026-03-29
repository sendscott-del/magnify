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
}

export function KanbanColumn({ title, callings, onCardPress, color = Colors.primary, headerAction }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.column}>
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
            <CallingCard key={c.id} calling={c} onPress={() => onCardPress(c)} />
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
