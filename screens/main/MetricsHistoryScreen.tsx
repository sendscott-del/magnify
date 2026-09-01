import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboard } from '../../context/DashboardContext';
import { formatMonthDay } from '../../lib/dashboard';
import { buildMetricSpecs, metricHistory } from '../../lib/dashboardMetrics';
import { DrillHeader } from '../../components/dashboard/DrillHeader';
import { CalmEmpty, cardBase } from '../../components/dashboard/primitives';

/**
 * Full quarterly history — one card per metric, every quarter on record.
 * This is the drill-down the home strip deliberately isn't: the strip answers
 * "where are we", this answers "how did we get here".
 */
export function MetricsHistoryScreen() {
  const nav = useNavigation<any>();
  const { t, language } = useLanguage();
  const data = useDashboard();

  const specs = useMemo(
    () => buildMetricSpecs(data.metrics, data.metricDefs, language, t('dash.metrics.target')),
    [data.metrics, data.metricDefs, language, t],
  );

  const syncedLabel = data.lastSyncedAt
    ? `${t('dash.metrics.lcrSync')} ${formatMonthDay(data.lastSyncedAt.slice(0, 10), language)}`
    : null;

  return (
    <View style={styles.root}>
      <DrillHeader
        title={t('dash.metrics.title')}
        subtitle={syncedLabel ?? undefined}
        onBack={() => nav.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {specs.length === 0 ? (
          <CalmEmpty title={t('dash.metrics.emptyTitle')} sub={t('dash.metrics.emptySub')} />
        ) : (
          specs.map(spec => {
            const history = metricHistory(data.metrics, spec.key);
            const max = Math.max(...history.map(h => h.value), 1);
            const deltaColor =
              spec.deltaTone === 'up' ? Colors.success :
              spec.deltaTone === 'down' ? Colors.error :
              Colors.gray[500];
            return (
              <View key={spec.key} style={styles.card}>
                <View style={styles.topRow}>
                  <Text style={styles.label}>{spec.label}</Text>
                  <View style={styles.valueCol}>
                    <Text style={styles.value}>{spec.value}</Text>
                    <Text style={[styles.delta, { color: deltaColor }]}>{spec.delta}</Text>
                  </View>
                </View>

                <View style={styles.chart}>
                  {history.map((h, i) => (
                    <View key={h.label} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(6, (h.value / max) * 56),
                            backgroundColor: i === history.length - 1 ? Colors.primary : '#C7D2E4',
                          },
                        ]}
                      />
                      <Text style={styles.barLabel} numberOfLines={1}>{h.label}</Text>
                    </View>
                  ))}
                </View>

                {!!spec.targetLabel && (
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>{spec.targetLabel}</Text>
                    {!!syncedLabel && <Text style={styles.footerSync}>{syncedLabel}</Text>}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { padding: Spacing.md, gap: 10 },
  card: { ...cardBase, padding: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  valueCol: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.gray[900],
    letterSpacing: -0.6,
  },
  delta: { fontSize: 12, fontWeight: '800' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 12,
  },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', borderRadius: 3 },
  barLabel: {
    fontSize: 9,
    color: Colors.gray[400],
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    marginTop: 10,
    paddingTop: 8,
  },
  footerText: { fontSize: FontSize.xs, color: Colors.gray[500] },
  footerSync: { fontSize: 10, color: Colors.gray[400] },
});
