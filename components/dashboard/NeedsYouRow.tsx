import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { DashboardItem, DuePill, KIND } from '../../lib/dashboard';
import { DuePillView, KindEyebrow, cardBase } from './primitives';

interface Props {
  item: DashboardItem;
  eyebrow: string;
  pill: DuePill | null;
  /** Owner chip — shown only in "Everyone" scope, where whose it is matters. */
  ownerLabel?: string | null;
  onPress: () => void;
  onDone: () => void;
  doneAccessibilityLabel: string;
}

/**
 * Zone 1 row. The done rail is a SIBLING of the body, not a child — that's the
 * whole point of the treatment: the tap target for "done" can never overlap
 * the tap target for "open the item", so nobody completes an item they meant
 * to read.
 */
export function NeedsYouRow({
  item, eyebrow, pill, ownerLabel, onPress, onDone, doneAccessibilityLabel,
}: Props) {
  return (
    <View style={[styles.row, { borderLeftColor: KIND[item.kind].color }]}>
      <TouchableOpacity style={styles.body} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.meta}>
          <KindEyebrow kind={item.kind} label={eyebrow} />
          {!!item.detail && (
            <Text style={styles.sub} numberOfLines={1}>{item.detail}</Text>
          )}
        </View>
        {(pill || ownerLabel) && (
          <View style={styles.chips}>
            {pill && <DuePillView pill={pill} />}
            {!!ownerLabel && (
              <View style={styles.ownerChip}>
                <Text style={styles.ownerChipText} numberOfLines={1}>{ownerLabel}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.rail}
        onPress={onDone}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={doneAccessibilityLabel}
      >
        <Ionicons name="checkmark-circle-outline" size={26} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardBase,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
    letterSpacing: -0.1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  sub: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    color: Colors.gray[500],
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  ownerChip: {
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 160,
  },
  ownerChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[500],
  },
  rail: {
    width: 56,
    borderLeftWidth: 1,
    borderLeftColor: Colors.gray[100],
    backgroundColor: Colors.gray[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
