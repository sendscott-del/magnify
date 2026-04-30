import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { Calling } from '../../lib/database.types';
import { useLanguage } from '../../context/LanguageContext';

const TYPE_BADGE_BG: Record<string, string> = {
  ward_calling: Colors.primary,
  stake_calling: Colors.primaryDark,
  mp_ordination: Colors.accent,
};

const TYPE_BADGE_TEXT: Record<string, string> = {
  ward_calling: Colors.white,
  stake_calling: Colors.white,
  mp_ordination: '#3A2E0E', // dark warm tone for legibility on gold
};

const TYPE_GLYPH: Record<string, keyof typeof Ionicons.glyphMap> = {
  ward_calling: 'people-outline',
  stake_calling: 'business-outline',
  mp_ordination: 'key-outline',
};

interface Props {
  calling: Calling;
  onPress: () => void;
  isNew?: boolean;
}

export function CallingCard({ calling, onPress, isNew }: Props) {
  const { t } = useLanguage();

  const STAGE_LABELS: Record<string, string> = {
    ideas: t('stage.ideas'),
    for_approval: t('stage.for_approval'),
    stake_approved: t('stage.stake_approved'),
    hc_approval: t('stage.hc_approval'),
    issue_calling: t('stage.issue_calling'),
    ordained: t('stage.issue_calling'),
    sustain: t('stage.sustain'),
    set_apart: t('stage.set_apart'),
    record: t('stage.record'),
    complete: t('stage.complete'),
  };

  const TYPE_LABELS: Record<string, string> = {
    ward_calling: t('type.ward_calling'),
    stake_calling: t('type.stake_calling'),
    mp_ordination: t('type.mp_ordination'),
  };

  const STAGE_COLOR: Record<string, string> = (Colors.stage as any) ?? {};
  const stageColor = STAGE_COLOR[calling.stage] ?? Colors.gray[500];

  const wardLabel = calling.wards?.abbreviation || calling.wards?.name?.slice(0, 3).toUpperCase() || '—';

  return (
    <TouchableOpacity
      style={[styles.card, calling.rejected && styles.rejected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <View style={[styles.wardBadge, { backgroundColor: TYPE_BADGE_BG[calling.type] }]}>
          <Text style={[styles.wardBadgeText, { color: TYPE_BADGE_TEXT[calling.type] }]} numberOfLines={1}>
            {wardLabel}
          </Text>
        </View>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>{calling.member_name}</Text>
          <View style={styles.callingRow}>
            <Ionicons
              name={TYPE_GLYPH[calling.type] ?? 'document-outline'}
              size={11}
              color={Colors.gray[500]}
              style={styles.callingGlyph}
            />
            <Text style={styles.callingName} numberOfLines={1}>{calling.calling_name}</Text>
          </View>
        </View>
        {isNew && <View style={styles.newDot} />}
      </View>

      <View style={styles.foot}>
        <Text style={styles.typeLabel}>{(TYPE_LABELS[calling.type] ?? '').toUpperCase()}</Text>
        <View style={styles.stageRow}>
          <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
          <Text style={styles.stageText}>{STAGE_LABELS[calling.stage]}</Text>
        </View>
      </View>

      {calling.rejected && (
        <View style={styles.rejectedBanner}>
          <Text style={styles.rejectedText}>{t('detail.declined').toUpperCase()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md - 2,
    paddingTop: Spacing.md - 2,
    paddingBottom: Spacing.sm + 4,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  rejected: {
    borderColor: Colors.error,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    marginBottom: Spacing.sm + 2,
  },
  wardBadge: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  wardBadgeText: {
    fontFamily: 'Menlo',
    fontWeight: '700',
    fontSize: FontSize.sm,
    letterSpacing: 0.5,
  },
  who: { flex: 1, minWidth: 0 },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
    letterSpacing: -0.1,
  },
  callingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  callingGlyph: { opacity: 0.7 },
  callingName: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    flex: 1,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  typeLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: Colors.gray[500],
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageText: {
    fontSize: FontSize.sm - 1,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  rejectedBanner: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.error + '22',
    borderRadius: Radius.sm,
    padding: 3,
    alignItems: 'center',
  },
  rejectedText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
