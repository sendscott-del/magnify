import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../constants/theme';
import { DisplayKind } from '../../lib/dashboard';
import { FlagPill, GlyphChip, cardBase } from './primitives';

/* ------------------------------------------------------------------ tile -- */

export interface TileSpec {
  key: string;
  kind: DisplayKind;
  /** The number, already formatted (e.g. "3 of 9"). */
  value: string;
  /** What the number counts — "interviews", "wards", "in flight". */
  unit: string;
  label: string;
  sub?: string;
  flag?: { label: string; tone: 'late' | 'neutral' };
  /** Where tapping goes. `standard` must route to standard work, never interviews. */
  drill?: string;
}

/**
 * Zone 2 tile. Every tile answers how many, by when, whose — the sub-line is
 * not decoration and a tile without one is a tile that shouldn't exist.
 */
export function StatTile({ tile, onPress }: { tile: TileSpec; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${tile.label}: ${tile.value} ${tile.unit}`}
    >
      <View style={styles.tileTop}>
        <GlyphChip kind={tile.kind} />
        {tile.flag && <FlagPill label={tile.flag.label} tone={tile.flag.tone} />}
      </View>
      <View style={styles.numberRow}>
        <Text style={styles.number}>{tile.value}</Text>
        <Text style={styles.unit}>{tile.unit}</Text>
      </View>
      <Text style={styles.tileLabel}>{tile.label}</Text>
      {!!tile.sub && <Text style={styles.tileSub}>{tile.sub}</Text>}
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------ workstream -- */

export interface WorkstreamSpec {
  id: string;
  name: string;
  color: string;
  done: number;
  total: number;
  targetLabel?: string;
  nextLabel?: string;
}

/**
 * Zone 3 card. Milestone ticks, not a smooth bar — one tick per unit of work,
 * so "9 of 14" is countable at a glance instead of estimated from a fill.
 */
export function WorkstreamCard({
  ws, nextPrefix, countLabel, onPress,
}: {
  ws: WorkstreamSpec;
  nextPrefix: string;
  /** Already localised, e.g. "9 of 14 done" / "9 de 14 hechos". */
  countLabel: string;
  onPress?: () => void;
}) {
  // Above ~24 units the ticks stop being countable and start being a bar, so
  // cap the rendered ticks and let the "N of M" line carry the precision.
  const ticks = Math.min(ws.total, 24);
  const filled = ws.total ? Math.round((ws.done / ws.total) * ticks) : 0;

  return (
    <TouchableOpacity
      style={[styles.wsCard, { borderTopColor: ws.color }]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <Text style={styles.wsName}>{ws.name}</Text>
      <View style={styles.tickRow}>
        {Array.from({ length: Math.max(ticks, 1) }, (_, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              { backgroundColor: i < filled ? ws.color : Colors.gray[100] },
            ]}
          />
        ))}
      </View>
      <View style={styles.wsMeta}>
        <Text style={styles.wsCount}>{countLabel}</Text>
        {!!ws.targetLabel && <Text style={styles.wsTarget}>{ws.targetLabel}</Text>}
      </View>
      {!!ws.nextLabel && (
        <View style={styles.wsNextWrap}>
          <Text style={styles.wsNext} numberOfLines={2}>
            {nextPrefix} {ws.nextLabel}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* --------------------------------------------------------------- metrics -- */

export interface MetricSpec {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: 'up' | 'down' | 'flat';
  /** Oldest → newest. The last bar is the current quarter. */
  series: number[];
  targetLabel?: string;
}

export function MetricCard({ metric, onPress }: { metric: MetricSpec; onPress?: () => void }) {
  const max = Math.max(...metric.series, 1);
  const deltaColor =
    metric.deltaTone === 'up' ? Colors.success :
    metric.deltaTone === 'down' ? Colors.error :
    Colors.gray[500];

  return (
    <TouchableOpacity
      style={styles.metricCard}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{metric.value}</Text>
        <Text style={[styles.metricDelta, { color: deltaColor }]}>{metric.delta}</Text>
      </View>
      <View style={styles.spark}>
        {metric.series.map((v, i) => (
          <View
            key={i}
            style={[
              styles.sparkBar,
              {
                height: Math.max(4, (v / max) * 26),
                backgroundColor: i === metric.series.length - 1 ? Colors.primary : '#C7D2E4',
              },
            ]}
          />
        ))}
      </View>
      {!!metric.targetLabel && <Text style={styles.metricTarget}>{metric.targetLabel}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    ...cardBase,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
    minHeight: 118,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flexWrap: 'wrap',
  },
  number: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.gray[900],
    letterSpacing: -1,
    lineHeight: 32,
  },
  unit: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[500],
  },
  tileLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray[700],
    lineHeight: 17,
  },
  tileSub: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 'auto',
  },

  wsCard: {
    ...cardBase,
    borderTopWidth: 3,
    padding: 14,
  },
  wsName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  tickRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 12,
  },
  tick: {
    flex: 1,
    height: 10,
    borderRadius: 2,
  },
  wsMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  wsCount: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.gray[700],
  },
  wsTarget: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.gray[500],
  },
  wsNextWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    marginTop: 8,
    paddingTop: 8,
  },
  wsNext: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
  },

  metricCard: {
    ...cardBase,
    padding: 12,
    minWidth: 160,
    maxWidth: 220,
  },
  metricLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[500],
    lineHeight: 14,
    minHeight: 28,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  metricValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.gray[900],
    letterSpacing: -0.6,
  },
  metricDelta: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 26,
    marginTop: 8,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
  },
  metricTarget: {
    fontSize: 10,
    color: Colors.gray[400],
    marginTop: 6,
  },
});
