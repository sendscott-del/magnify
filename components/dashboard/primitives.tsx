import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Shadow } from '../../constants/theme';
import { DisplayKind, DuePill, KIND, tint } from '../../lib/dashboard';

/**
 * Small shared pieces of the dashboard. Everything here is presentational —
 * no data access, no navigation — so the same parts render on phone and on
 * full-width desktop web without a branch.
 */

/** Section title + a right-hand all-caps count/scope note. */
export function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!note && <Text style={styles.sectionNote} numberOfLines={1}>{note}</Text>}
    </View>
  );
}

export function DuePillView({ pill }: { pill: DuePill }) {
  return (
    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
      <Text style={[styles.pillText, { color: pill.color }]} numberOfLines={1}>
        {pill.label}
      </Text>
    </View>
  );
}

/** The all-caps kind eyebrow — RECOMMEND, AUDIT, ASSIGNMENT… */
export function KindEyebrow({ kind, label }: { kind: DisplayKind; label: string }) {
  return (
    <Text style={[styles.eyebrow, { color: KIND[kind].color }]} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
  );
}

/** 26×26 rounded chip holding a kind glyph, filled at 13% of the kind color. */
export function GlyphChip({ kind, size = 26 }: { kind: DisplayKind; size?: number }) {
  const cfg = KIND[kind];
  return (
    <View
      style={[
        styles.glyphChip,
        { width: size, height: size, backgroundColor: tint(cfg.color) },
      ]}
    >
      <Ionicons name={cfg.icon} size={Math.round(size * 0.58)} color={cfg.color} />
    </View>
  );
}

/** Small status flag on a tile — "2 LATE", or a neutral "LCR" for synced data. */
export function FlagPill({ label, tone }: { label: string; tone: 'late' | 'neutral' }) {
  const color = tone === 'late' ? Colors.error : Colors.gray[600];
  const bg = tone === 'late' ? '#FEE2E2' : Colors.gray[100];
  return (
    <View style={[styles.flag, { backgroundColor: bg }]}>
      <Text style={[styles.flagText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

interface SegmentedProps<TValue extends string> {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (v: TValue) => void;
}

export function Segmented<TValue extends string>({ value, options, onChange }: SegmentedProps<TValue>) {
  return (
    <View style={styles.segTrack}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={[styles.seg, active && styles.segActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * The dashboard's empty states are a feature, not a fallback — "nothing
 * waiting on you" is the answer the presidency wants most.
 */
export function CalmEmpty({
  title, sub, icon, tone = 'success',
}: {
  title: string;
  sub?: string;
  /** Defaults to the green "all clear" tick. Pass a neutral glyph for a
   *  "nothing set up yet" state, which is not an accomplishment. */
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'success' | 'neutral';
}) {
  return (
    <View style={styles.empty}>
      <Ionicons
        name={icon ?? 'checkmark-done'}
        size={30}
        color={tone === 'success' ? Colors.success : Colors.gray[300]}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!sub && <Text style={styles.emptySub}>{sub}</Text>}
    </View>
  );
}

/** Coloured callout used by the standard-work explainer and the privacy banner. */
export function Callout({
  icon, tone, children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'info' | 'warning';
  children: React.ReactNode;
}) {
  const fill = tone === 'info' ? '#EFF6FF' : '#FEF3C7';
  const border = tone === 'info' ? '#2563EB' : Colors.warning;
  const text = tone === 'info' ? '#1E3A8A' : '#78350F';
  const glyph = tone === 'info' ? '#2563EB' : '#92600a';
  return (
    <View style={[styles.callout, { backgroundColor: fill, borderColor: border }]}>
      <Ionicons name={icon} size={18} color={glyph} />
      <Text style={[styles.calloutText, { color: text }]}>{children}</Text>
    </View>
  );
}

export const cardBase = {
  backgroundColor: Colors.white,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.gray[200],
  ...(Shadow as object),
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[800],
  },
  sectionNote: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pill: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  glyphChip: {
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  flagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.full,
    padding: 2,
  },
  seg: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  segActive: {
    backgroundColor: Colors.white,
  },
  segText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray[500],
  },
  segTextActive: {
    color: Colors.primary,
  },
  empty: {
    ...cardBase,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[800],
    marginTop: 8,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: 4,
    textAlign: 'center',
  },
  callout: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  calloutText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
