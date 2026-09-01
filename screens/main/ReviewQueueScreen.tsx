import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboard } from '../../context/DashboardContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import { DashboardItem, formatMonthDay } from '../../lib/dashboard';
import { DrillHeader } from '../../components/dashboard/DrillHeader';
import { ItemSheet } from '../../components/dashboard/ItemSheet';
import { Toast } from '../../components/dashboard/Toast';
import { CalmEmpty, Callout, cardBase } from '../../components/dashboard/primitives';

/**
 * The meeting-item review queue.
 *
 * Nothing extracted from a meeting recording appears anywhere on the dashboard
 * until it is approved here — that gate is why processing stake presidency
 * meetings is acceptable at all. The privacy banner states the contract to the
 * person doing the approving: transcripts are not stored, and extracted items
 * are scheduling shells with worthiness, discipline and welfare specifics
 * already dropped.
 */
export function ReviewQueueScreen() {
  const nav = useNavigation<any>();
  const { t, language } = useLanguage();
  const data = useDashboard();
  const isDesktopWeb = useIsDesktopWeb();

  const [editing, setEditing] = useState<DashboardItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      <DrillHeader
        title={t('dash.review.title')}
        subtitle={`${data.pending.length} ${t('dash.review.pendingCount')}`}
        onBack={() => nav.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Callout icon="lock-closed-outline" tone="warning">
          {t('dash.review.privacy')}
        </Callout>

        {data.pending.length === 0 ? (
          <CalmEmpty title={t('dash.review.emptyTitle')} sub={t('dash.review.emptySub')} />
        ) : (
          data.pending.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardBody}>
                <View style={styles.eyebrowRow}>
                  <Text style={styles.pendingEyebrow}>{t('dash.review.pendingEyebrow')}</Text>
                  <Text style={styles.meetingRef} numberOfLines={1}>
                    {`· ${meetingOf(item) ?? t('dash.source.meeting')}`}
                  </Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <View style={styles.chipRow}>
                  {!!(item.owner_label ?? item.owner_user_id) && (
                    <Chip text={`${t('dash.sheet.owner')}: ${item.owner_label
                      ?? data.ownerNames[item.owner_user_id!] ?? ''}`} />
                  )}
                  {!!item.due_on && (
                    <Chip text={`${t('dash.sheet.due')} ${formatMonthDay(item.due_on, language)}`} />
                  )}
                  <Chip text={t(`dash.kind.${item.kind}` as TranslationKey)} />
                </View>
              </View>

              <View style={styles.actionBar}>
                <TouchableOpacity
                  style={styles.approve}
                  onPress={() => {
                    void data.approvePending(item.id);
                    setToast(t('dash.review.approvedToast'));
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color={Colors.white} />
                  <Text style={styles.approveText}>{t('dash.review.approve')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditing(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.editText}>{t('dash.sheet.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.discard}
                  onPress={() => {
                    void data.discardPending(item.id);
                    setToast(t('dash.review.discardedToast'));
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discardText}>{t('dash.review.discard')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ItemSheet
        item={editing}
        visible={!!editing}
        startInEdit
        owners={data.owners}
        workstreams={data.workstreams}
        ownerNames={data.ownerNames}
        language={language}
        t={t}
        onClose={() => setEditing(null)}
        onSave={patch => {
          if (editing) void data.updateItem(editing.id, patch);
          setToast(t('dash.toast.saved'));
        }}
        onToggleDone={() => {}}
      />

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

function meetingOf(item: DashboardItem): string | null {
  return (item.source_ref as { meeting?: string } | undefined)?.meeting ?? null;
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { padding: Spacing.md, gap: 10 },
  card: { ...cardBase, overflow: 'hidden' },
  cardBody: { paddingVertical: 12, paddingHorizontal: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#8B5CF6',
  },
  meetingRef: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gray[400],
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
    marginTop: 7,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: 220,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[700],
  },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.gray[50],
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  approve: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  approveText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  editBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  discard: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: { color: Colors.gray[500], fontSize: FontSize.sm, fontWeight: '600' },
});
