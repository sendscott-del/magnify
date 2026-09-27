import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Pressable } from 'react-native';
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
import { CheckRow } from '../../components/dashboard/CheckRow';
import { KIND, StandardWorkRow } from '../../lib/dashboard';
import { SafeModal } from '../../components/ui/SafeModal';
import { Button } from '../../components/ui/Button';

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
  const [noteFor, setNoteFor] = useState<StandardWorkRow | null>(null);

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
          <View style={styles.list}>
            {data.standardWork.map(row => {
              const isDone = row.value === 'y';
              return (
                <CheckRow
                  key={row.id}
                  title={row.name}
                  sub={`${t(FREQUENCY_KEY[row.frequency] ?? 'dash.freq.weekly')} · ${t('dash.standard.due')} ${formatMonthDay(row.period_start, language)}`}
                  note={row.note}
                  right={isDone ? t('dash.standard.done') : t('dash.standard.notYet')}
                  rightColor={isDone ? Colors.success : Colors.gray[400]}
                  done={isDone}
                  accent={KIND.standard.color}
                  onToggle={() => {
                    void data.setStandardWorkDone(row.id, !isDone);
                    setToast(isDone ? t('dash.toast.standardCleared') : t('dash.toast.standardDone'));
                  }}
                  onOpen={() => setNoteFor(row)}
                  toggleLabel={t('dash.row.markDone')}
                />
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>{t('dash.standard.writesBack')}</Text>
      </ScrollView>

      <StandardWorkNoteSheet
        row={noteFor}
        onClose={() => setNoteFor(null)}
        onSave={note => {
          if (noteFor) void data.setStandardWorkNote(noteFor.id, note);
          setNoteFor(null);
          setToast(t('dash.toast.saved'));
        }}
        t={t}
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

/**
 * Notes on one standard-work duty for this period. Stored in Steward's
 * steward_cell_comments (037), so the note appears on that cell in Steward's
 * grid as well — Magnify never keeps its own copy of standard work.
 */
function StandardWorkNoteSheet({ row, onClose, onSave, t }: {
  row: StandardWorkRow | null;
  onClose: () => void;
  onSave: (note: string) => void;
  t: (k: TranslationKey) => string;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (row) setText(row.note ?? ''); }, [row]);
  return (
    <SafeModal visible={!!row} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <Text style={styles.sheetTitle} numberOfLines={2}>{row?.name}</Text>
          <Text style={styles.sheetLabel}>{t('dash.row.notes')}</Text>
          <TextInput
            style={styles.noteInput}
            value={text}
            onChangeText={setText}
            placeholder={t('dash.row.notesPlaceholder')}
            placeholderTextColor={Colors.gray[400]}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.sheetActions}>
            <TouchableOpacity onPress={onClose} style={styles.cancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t('detail.cancel')}</Text>
            </TouchableOpacity>
            <Button title={t('dash.edit.save')} onPress={() => onSave(text)} variant="primary" style={styles.saveBtn} />
          </View>
        </Pressable>
      </Pressable>
    </SafeModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  list: { gap: 8 },
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: Spacing.md },
  sheet: { ...cardBase, padding: 16, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.gray[900] },
  sheetLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.gray[500], letterSpacing: 0.3 },
  noteInput: {
    minHeight: 110, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 10,
    padding: 10, fontSize: FontSize.md, color: Colors.gray[900],
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancel: { paddingHorizontal: 8, paddingVertical: 10 },
  cancelText: { fontSize: FontSize.md, color: Colors.gray[600], fontWeight: '600' },
  saveBtn: { minWidth: 110 },
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
