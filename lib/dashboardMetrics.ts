import { MetricSpec } from '../components/dashboard/cards';
import { MetricDef, MetricPoint, quarterLabel } from './dashboard';

/** How many quarters the sparkline shows. Matches the design's 8 bars. */
const SPARK_QUARTERS = 8;

function formatValue(value: number, unit?: string | null, language: 'en' | 'es' = 'en'): string {
  if (unit === '%') return `${Math.round(value)}%`;
  return value.toLocaleString(language === 'es' ? 'es-ES' : 'en-US');
}

/**
 * Turn raw metric rows into the strip's cards.
 *
 * Delta is against the immediately prior quarter present in the data, not
 * against a fixed offset — a stake that skipped a quarter's LCR sync should
 * compare to the last real reading rather than showing a fabricated collapse.
 */
export function buildMetricSpecs(
  metrics: MetricPoint[],
  defs: MetricDef[],
  language: 'en' | 'es',
  /** Localised "Target" word; the card renders "Target 750". */
  targetPrefix: string,
): MetricSpec[] {
  const byKey: Record<string, MetricPoint[]> = {};
  for (const m of metrics) {
    (byKey[m.metric_key] ??= []).push(m);
  }

  return defs
    .filter(d => byKey[d.metric_key]?.length)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(def => {
      const points = byKey[def.metric_key]
        .slice()
        .sort((a, b) => a.period_start.localeCompare(b.period_start));
      const window = points.slice(-SPARK_QUARTERS);
      const latest = points[points.length - 1];
      const prior = points[points.length - 2];

      const diff = prior ? latest.value - prior.value : 0;
      const deltaTone: MetricSpec['deltaTone'] =
        !prior || diff === 0 ? 'flat'
        : (diff > 0) === (def.direction === 'up') ? 'up'
        : 'down';
      const delta =
        !prior || diff === 0
          ? '±0'
          : `${diff > 0 ? '+' : '−'}${formatValue(Math.abs(diff), def.unit, language)}`;

      return {
        key: def.metric_key,
        label: (language === 'es' && def.label_es) ? def.label_es : def.label,
        value: formatValue(latest.value, def.unit, language),
        delta,
        deltaTone,
        series: window.map(p => p.value),
        targetLabel: latest.target != null
          ? `${targetPrefix} ${formatValue(latest.target, def.unit, language)}`
          : undefined,
      };
    });
}

/** Bars for the history screen — every quarter on record, with its label. */
export function metricHistory(
  metrics: MetricPoint[],
  metricKey: string,
): Array<{ label: string; value: number }> {
  return metrics
    .filter(m => m.metric_key === metricKey)
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map(m => ({ label: quarterLabel(m.period_start), value: m.value }));
}
