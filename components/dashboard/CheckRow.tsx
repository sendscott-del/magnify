import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize } from '../../constants/theme';
import { cardBase } from './primitives';

/**
 * One row for everything on the dashboard that can be finished: an
 * assignment, a quarterly interview, a standard-work duty.
 *
 * Scott asked (2026-09-27) for those three to "be configured exactly the same
 * way": a done button you can press without opening the card, and a place for
 * notes. They had drifted — standard work had the button but nowhere to write,
 * interviews and assignments had neither — because each screen rendered its
 * own row. This component is the fix for the drift, not just for
 * the three rows: a fourth list that uses it gets the same behaviour for free,
 * and nobody can quietly give one of them a different shape again.
 *
 * Two targets, deliberately separate:
 *   - the circle marks it done (or undone) and does nothing else;
 *   - the rest of the row opens it — the sheet with its notes and details.
 * A single whole-row tap, as standard work used to have, made "open to add a
 * note" impossible without also flipping the done state.
 */
export interface CheckRowProps {
  title: string;
  sub?: string | null;
  /** Top-right: a due date, "Done", a scheduled date. */
  right?: string | null;
  rightColor?: string;
  /** Under it: an owner or assignee. */
  rightSub?: string | null;
  /** A notes line, shown faintly when there is one. */
  note?: string | null;
  done: boolean;
  accent: string;
  /** Absent when the viewer may not complete this (e.g. a high councilor's own interview). */
  onToggle?: () => void;
  /** Absent when there is nothing to open. */
  onOpen?: () => void;
  toggleLabel: string;
}

export function CheckRow({
  title, sub, right, rightColor, rightSub, note, done, accent, onToggle, onOpen, toggleLabel,
}: CheckRowProps) {
  return (
    <View style={[styles.row, { borderLeftColor: accent }]}>
      {onToggle ? (
        <TouchableOpacity
          onPress={onToggle}
          hitSlop={10}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={toggleLabel}
          activeOpacity={0.6}
        >
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={done ? Colors.success : Colors.gray[300]}
          />
        </TouchableOpacity>
      ) : (
        // Keep the column so read-only rows line up with the ones beside them.
        <View style={styles.check}>
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={done ? Colors.success : Colors.gray[200]}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.body}
        onPress={onOpen}
        disabled={!onOpen}
        activeOpacity={0.8}
        accessibilityRole={onOpen ? 'button' : undefined}
      >
        <View style={styles.left}>
          <Text style={[styles.title, done && styles.titleDone]}>{title}</Text>
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
          {!!note && (
            <View style={styles.noteRow}>
              <Ionicons name="document-text-outline" size={12} color={Colors.gray[400]} />
              <Text style={styles.note} numberOfLines={2}>{note}</Text>
            </View>
          )}
        </View>
        {(!!right || !!rightSub) && (
          <View style={styles.right}>
            {!!right && <Text style={[styles.rightText, { color: rightColor ?? Colors.gray[600] }]}>{right}</Text>}
            {!!rightSub && <Text style={styles.rightSub} numberOfLines={1}>{rightSub}</Text>}
          </View>
        )}
        {!!onOpen && <Ionicons name="chevron-forward" size={16} color={Colors.gray[300]} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...cardBase,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  check: { paddingVertical: 12, paddingRight: 8, paddingLeft: 2 },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingRight: 12,
    minWidth: 0,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  titleDone: { color: Colors.gray[400], textDecorationLine: 'line-through' },
  sub: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 4 },
  note: { flex: 1, fontSize: FontSize.xs, color: Colors.gray[500], fontStyle: 'italic', lineHeight: 16 },
  right: { alignItems: 'flex-end', maxWidth: 130 },
  rightText: { fontSize: FontSize.xs, fontWeight: '800' },
  rightSub: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 2 },
});
