import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboard } from '../../context/DashboardContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import { formatMonthDay } from '../../lib/dashboard';
import { DrillHeader } from '../../components/dashboard/DrillHeader';
import { Toast } from '../../components/dashboard/Toast';
import { CalmEmpty, Callout, cardBase } from '../../components/dashboard/primitives';

const FREQUENCY_KEY: Record<string, TranslationKey> = {
  weekly: 'dash.freq.weekly',
  monthly: 'dash.freq.monthly',
  quarterly: 'dash.freq.quarterly',
};

/**
 * Standard work — a DISTINCT screen from the interview list.
 *
 * This separation is the whole point: standard work is a recurring duty of the
 * calling (attend bishopric meeting, visit an assigned ward), and an interview
 * is a one-off conversation with a named person on a date. They were being
 * conflated, so this screen opens by saying what the difference is, and the
 * standard-work tile must never route to a list of interviews.
 *
 * Rows are read live from Steward and marking one done writes back through
 * `magnify_dash_set_standard_work`, which fans out to every participant of a
 * shared behavior.
 */
export function StandardWorkScreen() {
  const nav = useNavigation<any>();
  const { t, language } = useLanguage();
  const data = useDashboard();
  const isDesktopWeb = useIsDesktopWeb();
  const [toast, setToast] = useState<string | null>(null);

  const done = data.standardWork.filter(r => r.value === 'y').length;
  const weekOf = data.standardWork[0]?.period_start;

  return (
    <View style={styles.root}>
      <DrillHeader
        title={t('dash.tile.myStandardWork')}
        subtitle={[
          `${done} ${t('dash.unit.of')} ${data.standardWork.length} ${t('dash.unit.done')}`,
          weekOf ? `${t('dash.sub.weekOf')} ${formatMonthDay(weekOf, language)}` : null,
        ].filter(Boolean).join(' · ')}
        onBack={() => nav.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Callout icon="repeat-outline" tone="info">
          {t('dash.standard.explainer')}
        </Callout>

        {data.standardWork.length === 0 ? (
          <CalmEmpty title={t('dash.standard.emptyTitle')} sub={t('dash.standard.emptySub')} />
        ) : (
          <View style={styles.card}>
            {data.standardWork.map((row, i) => {
              const isDone = row.value === 'y';
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  activeOpacity={0.8}
                  onPress={() => {
                    void data.setStandardWorkDone(row.id, !isDone);
                    setToast(isDone ? t('dash.toast.standardCleared') : t('dash.toast.standardDone'));
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone }}
                >
                  <Ionicons
                    name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isDone ? Colors.success : Colors.gray[300]}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{row.name}</Text>
                    <Text style={styles.rowSub}>
                      {t(FREQUENCY_KEY[row.frequency] ?? 'dash.freq.weekly')}
                      {' · '}
                      {t('dash.standard.due')} {formatMonthDay(row.period_start, language)}
                    </Text>
                  </View>
                  <Text style={[styles.state, { color: isDone ? Colors.success : Colors.gray[400] }]}>
                    {isDone ? t('dash.standard.done') : t('dash.standard.notYet')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>{t('dash.standard.writesBack')}</Text>
      </ScrollView>

      {toast && (
        <Toast
          message={toast}
          onDismiss={() => setToast(null)}
          bottomOffset={isDesktopWeb ? 0 : 56}
          durationMs={2500}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { padding: Spacing.md, gap: 16 },
  card: { ...cardBase, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  rowSub: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 2,
  },
  state: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  footnote: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    lineHeight: 16,
  },
});
