import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeModal } from '../ui/SafeModal';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { DashInterview, formatLongDate, parseDate, todayISO } from '../../lib/dashboard';
import { KindEyebrow } from './primitives';

type T = (key: TranslationKey) => string;

export interface InterviewDraft {
  id?: string | null;
  interviewee_name: string;
  interviewee_calling?: string | null;
  assigned_to_user_id?: string | null;
  scheduled_for?: string | null;
}

interface Props {
  /** null = create a new interview. */
  interview: DashInterview | null;
  visible: boolean;
  assignees: Array<{ id: string; name: string }>;
  language: 'en' | 'es';
  t: T;
  onClose: () => void;
  onSave: (draft: InterviewDraft) => void;
  onComplete: (done: boolean) => void;
  onDelete: () => void;
}

/**
 * Quarterly interview — create, edit, complete, reassign, delete.
 *
 * Interviews live in Steward's table; every action here goes through a
 * write-through RPC (migration 025) so Steward's grid and the exec-sec agent
 * see the same row. This sheet is the reason a presidency member never has to
 * open Steward to mark an interview done.
 */
export function InterviewSheet({
  interview, visible, assignees, language, t, onClose, onSave, onComplete, onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const isNew = !interview;

  const [name, setName] = useState('');
  const [calling, setCalling] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(interview?.interviewee_name ?? '');
    setCalling(interview?.interviewee_calling ?? '');
    setAssignee(interview?.assigned_to_user_id ?? null);
    setScheduled(interview?.scheduled_for ?? null);
    setPickerOpen(false);
    setConfirmDelete(false);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, interview?.id, anim]); // eslint-disable-line react-hooks/exhaustive-deps

  function shift(days: number) {
    const d = parseDate(scheduled ?? todayISO());
    d.setDate(d.getDate() + days);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    setScheduled(`${d.getFullYear()}-${m}-${day}`);
  }

  function save() {
    if (!name.trim()) return;
    onSave({
      id: interview?.id ?? null,
      interviewee_name: name.trim(),
      interviewee_calling: calling.trim() || null,
      assigned_to_user_id: assignee,
      scheduled_for: scheduled,
    });
    onClose();
  }

  const assigneeName = assignees.find(a => a.id === assignee)?.name ?? t('dash.sheet.unassigned');
  const isDone = !!interview?.completed_at;

  return (
    <SafeModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.wrap}>
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: anim,
                paddingBottom: insets.bottom + 16,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} hitSlop={10}>
                  <Text style={styles.cancel}>{t('dash.edit.cancel')}</Text>
                </TouchableOpacity>
                <View style={styles.headerMid}>
                  <KindEyebrow kind="interview" label={t('dash.kind.interview')} />
                  <Text style={styles.title}>
                    {isNew ? t('dash.interview.newTitle') : t('dash.interview.title')}
                  </Text>
                </View>
                <TouchableOpacity onPress={save} hitSlop={10}>
                  <Text style={styles.saveLink}>{t('dash.edit.save')}</Text>
                </TouchableOpacity>
              </View>

              {isDone && interview?.completed_at && (
                <View style={styles.doneBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.doneText}>
                    {t('dash.interview.doneOn')} {formatLongDate(interview.completed_at, language)}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>{t('dash.interview.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('dash.interview.namePlaceholder')}
                placeholderTextColor={Colors.gray[400]}
              />

              <Text style={styles.label}>{t('dash.interview.callingLabel')}</Text>
              <TextInput
                style={styles.input}
                value={calling}
                onChangeText={setCalling}
                placeholderTextColor={Colors.gray[400]}
              />

              <Text style={styles.label}>{t('dash.interview.assigneeLabel')}</Text>
              <TouchableOpacity style={styles.pickerRow} onPress={() => setPickerOpen(o => !o)} activeOpacity={0.8}>
                <Text style={styles.pickerValue} numberOfLines={1}>{assigneeName}</Text>
                <Ionicons name="chevron-expand-outline" size={18} color={Colors.gray[400]} />
              </TouchableOpacity>
              {pickerOpen && (
                <View style={styles.pickerList}>
                  {assignees.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.pickerOption}
                      onPress={() => { setAssignee(a.id); setPickerOpen(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pickerOptionText}>{a.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => { setAssignee(null); setPickerOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pickerOptionSub}>{t('dash.sheet.unassigned')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>{t('dash.interview.dateLabel')}</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepper} onPress={() => shift(-1)} activeOpacity={0.8}>
                  <Ionicons name="remove" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <View style={styles.stepperValue}>
                  <Text style={styles.pickerValue}>
                    {scheduled ? formatLongDate(scheduled, language) : t('dash.interview.unscheduled')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.stepper} onPress={() => shift(1)} activeOpacity={0.8}>
                  <Ionicons name="add" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !name.trim() && styles.primaryBtnDisabled]}
                disabled={!name.trim()}
                onPress={save}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>{t('dash.interview.save')}</Text>
              </TouchableOpacity>

              {!isNew && (
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => { onComplete(!isDone); onClose(); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isDone ? 'refresh-outline' : 'checkmark'}
                      size={16}
                      color={Colors.primary}
                    />
                    <Text style={styles.secondaryBtnText}>
                      {isDone ? t('dash.interview.reopen') : t('dash.interview.markDone')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteBtn, confirmDelete && styles.deleteBtnArmed]}
                    onPress={() => {
                      if (!confirmDelete) { setConfirmDelete(true); return; }
                      onDelete();
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                    <Text style={styles.deleteBtnText} numberOfLines={2}>
                      {confirmDelete ? t('dash.interview.deleteConfirm') : t('dash.sheet.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.confidential}>{t('dash.sheet.confidential')}</Text>
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </SafeModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17,17,17,0.35)', justifyContent: 'flex-end', alignItems: 'center' },
  wrap: { width: '100%', maxWidth: 640, maxHeight: '88%' },
  sheet: {
    width: '100%',
    flexShrink: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as object)
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 }),
  },
  scroll: { flexShrink: 1 },
  grabber: { width: 36, height: 4, borderRadius: Radius.full, backgroundColor: Colors.gray[200], alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerMid: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  // No fixed width: "Cancelar" / "Guardar" are longer than their English
  // counterparts and wrapped mid-word at 56px.
  cancel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[500], flexShrink: 0 },
  saveLink: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, flexShrink: 0 },
  doneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ECFDF5', borderRadius: Radius.md, padding: 10, marginTop: 12,
  },
  doneText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.success },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], letterSpacing: 0.3, marginTop: 16, marginBottom: 6 },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 12, fontSize: FontSize.md, color: Colors.gray[900], backgroundColor: Colors.white,
  },
  pickerRow: {
    height: 48, borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: Colors.white,
  },
  pickerValue: { flex: 1, fontSize: FontSize.md, color: Colors.gray[900] },
  pickerList: { borderWidth: 1, borderColor: Colors.gray[200], borderRadius: Radius.md, marginTop: 6, overflow: 'hidden' },
  pickerOption: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  pickerOptionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[800] },
  pickerOptionSub: { fontSize: FontSize.sm, color: Colors.gray[500] },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: {
    width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  stepperValue: {
    flex: 1, height: 48, borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 12, justifyContent: 'center',
  },
  primaryBtn: {
    height: 48, borderRadius: Radius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  primaryBtnDisabled: { backgroundColor: Colors.gray[300] },
  primaryBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.white,
  },
  secondaryBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, borderRadius: Radius.md, paddingHorizontal: 8,
  },
  deleteBtnArmed: { backgroundColor: '#FEE2E2' },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.error, flexShrink: 1, textAlign: 'center' },
  confidential: { fontSize: 10, color: Colors.gray[400], textAlign: 'center', marginTop: 14, lineHeight: 14 },
});
