import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import {
  DashboardItem, ItemStatus, Workstream,
  duePill, formatLongDate, parseDate, todayISO,
} from '../../lib/dashboard';
import { OwnerOption } from '../../lib/useDashboardData';
import { DuePillView, KindEyebrow } from './primitives';

type T = (key: TranslationKey) => string;

interface Props {
  item: DashboardItem | null;
  visible: boolean;
  owners: OwnerOption[];
  workstreams: Workstream[];
  ownerNames: Record<string, string>;
  language: 'en' | 'es';
  t: T;
  onClose: () => void;
  onSave: (patch: Partial<DashboardItem>) => void;
  onToggleDone: (done: boolean) => void;
  /** Opens straight into edit mode — used by the review queue's Edit action. */
  startInEdit?: boolean;
  /**
   * Create mode: the sheet is editing a blank draft that doesn't exist yet, so
   * it also offers a kind picker and Cancel closes instead of returning to a
   * detail view there is nothing to show.
   */
  createMode?: boolean;
}

const KIND_CYCLE: DashboardItem['kind'][] =
  ['action', 'assignment', 'interview', 'audit', 'recommend', 'directive'];

const STATUS_CYCLE: ItemStatus[] = ['open', 'in_progress', 'blocked', 'done', 'dropped'];

const STATUS_KEY: Record<ItemStatus, TranslationKey> = {
  open: 'dash.status.open',
  in_progress: 'dash.status.inProgress',
  blocked: 'dash.status.blocked',
  done: 'dash.status.done',
  dropped: 'dash.status.dropped',
};

const SOURCE_KEY: Record<string, TranslationKey> = {
  manual: 'dash.source.manual',
  meeting: 'dash.source.meeting',
  lcr_sync: 'dash.source.lcrSync',
  email: 'dash.source.email',
};

/**
 * Item detail + edit, in one bottom sheet.
 *
 * Editing is behind a VISIBLE Edit button, never a long-press or a swipe —
 * that was a locked decision, because a leader who can't find how to change a
 * due date will stop trusting the board.
 */
export function ItemSheet({
  item, visible, owners, workstreams, ownerNames, language, t,
  onClose, onSave, onToggleDone, startInEdit, createMode,
}: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
  const [draft, setDraft] = useState<Partial<DashboardItem>>({});
  // Edits already written this session. The parent holds `item` as a snapshot
  // taken when the sheet opened and does not re-feed it after a save, so
  // without this the detail view would flip back to the pre-edit values while
  // proudly announcing "Edited just now".
  const [committed, setCommitted] = useState<Partial<DashboardItem>>({});
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [wsPickerOpen, setWsPickerOpen] = useState(false);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode(startInEdit || createMode ? 'edit' : 'detail');
    setDraft({});
    setCommitted({});
    setEdited(false);
    setOwnerPickerOpen(false);
    setWsPickerOpen(false);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, item?.id, startInEdit, createMode, anim]);

  const merged = useMemo(
    () => (item ? ({ ...item, ...committed, ...draft } as DashboardItem) : null),
    [item, committed, draft],
  );

  if (!merged) return null;

  const pill = duePill(merged.due_on, t, language);
  const ownerText =
    merged.owner_label
    ?? (merged.owner_user_id ? ownerNames[merged.owner_user_id] : null)
    ?? t('dash.sheet.unassigned');
  const wsName = workstreams.find(w => w.id === merged.workstream_id)?.name ?? t('dash.sheet.none');

  function patch(p: Partial<DashboardItem>) {
    setDraft(prev => ({ ...prev, ...p }));
  }

  function shiftDue(days: number) {
    const base = merged!.due_on ?? todayISO();
    const d = parseDate(base);
    d.setDate(d.getDate() + days);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    patch({ due_on: `${d.getFullYear()}-${m}-${day}` });
  }

  function cycleStatus() {
    const i = STATUS_CYCLE.indexOf(merged!.status);
    patch({ status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] });
  }

  function save() {
    if (createMode) {
      // A blank title would create an unreadable row on the board; make the
      // Save a no-op rather than writing one.
      if (!merged!.title.trim()) return;
      onSave({ ...item, ...draft });
      setDraft({});
      onClose();
      return;
    }
    if (Object.keys(draft).length) {
      onSave(draft);
      setCommitted(prev => ({ ...prev, ...draft }));
      setEdited(true);
    }
    setDraft({});
    setMode('detail');
  }

  function cycleKind() {
    const i = KIND_CYCLE.indexOf(merged!.kind);
    patch({ kind: KIND_CYCLE[(i + 1) % KIND_CYCLE.length] });
  }

  const translate = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Stop the press from reaching the scrim when it lands on the sheet. */}
        <Pressable onPress={() => {}} style={styles.sheetWrap}>
          <Animated.View
            style={[
              styles.sheet,
              { opacity: anim, transform: [{ translateY: translate }], paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={styles.grabber} />
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
              {mode === 'detail'
                ? renderDetail()
                : renderEdit()}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  function renderDetail() {
    return (
      <>
        <View style={styles.eyebrowRow}>
          <KindEyebrow kind={merged!.kind} label={t(kindKey(merged!))} />
          {pill && <DuePillView pill={pill} />}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.title}>{merged!.title}</Text>
            {!!merged!.detail && <Text style={styles.titleSub}>{merged!.detail}</Text>}
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setMode('edit')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editBtnText}>{t('dash.sheet.edit')}</Text>
          </TouchableOpacity>
        </View>

        {edited && <Text style={styles.editedNote}>{t('dash.sheet.editedJustNow')}</Text>}

        <View style={styles.fieldList}>
          <FieldRow label={t('dash.sheet.owner')} value={ownerText} />
          <FieldRow
            label={t('dash.sheet.due')}
            value={merged!.due_on ? formatLongDate(merged!.due_on, language) : t('dash.sheet.noDueDate')}
          />
          <FieldRow label={t('dash.sheet.status')} value={t(STATUS_KEY[merged!.status])} />
          <FieldRow label={t('dash.sheet.workstream')} value={wsName} />
          <FieldRow label={t('dash.sheet.source')} value={t(SOURCE_KEY[merged!.source] ?? 'dash.source.manual')} />
          <FieldRow
            label={t('dash.sheet.reviewState')}
            value={merged!.review_state === 'approved'
              ? t('dash.review.stateApproved')
              : t('dash.review.statePending')}
            last
          />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { onToggleDone(merged!.status !== 'done'); onClose(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={18} color={Colors.white} />
            <Text style={styles.primaryBtnText}>
              {merged!.status === 'done' ? t('dash.sheet.markNotDone') : t('dash.sheet.markDone')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { setMode('edit'); setOwnerPickerOpen(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>{t('dash.sheet.reassign')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.confidential}>{t('dash.sheet.confidential')}</Text>
      </>
    );
  }

  function renderEdit() {
    return (
      <>
        <View style={styles.editHeader}>
          <TouchableOpacity
            onPress={() => {
              setDraft({});
              if (createMode) onClose(); else setMode('detail');
            }}
            hitSlop={10}
          >
            <Text style={styles.cancel}>{t('dash.edit.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.editTitle}>
            {createMode ? t('dash.edit.newTitle') : t('dash.edit.title')}
          </Text>
          <TouchableOpacity onPress={save} hitSlop={10}>
            <Text style={styles.saveLink}>{t('dash.edit.save')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>{t('dash.edit.titleLabel')}</Text>
        <TextInput
          style={styles.input}
          value={merged!.title}
          onChangeText={v => patch({ title: v })}
          placeholder={createMode ? t('dash.edit.titlePlaceholder') : undefined}
          placeholderTextColor={Colors.gray[400]}
        />

        {createMode && (
          <>
            <Text style={styles.fieldLabel}>{t('dash.edit.kindLabel')}</Text>
            <TouchableOpacity style={styles.pickerRow} onPress={cycleKind} activeOpacity={0.8}>
              <Text style={styles.pickerValue}>{t(kindKey(merged!))}</Text>
              <Ionicons name="chevron-expand-outline" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.fieldLabel}>{t('dash.edit.ownerLabel')}</Text>
        <TouchableOpacity
          style={styles.pickerRow}
          onPress={() => setOwnerPickerOpen(o => !o)}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerValue} numberOfLines={1}>{ownerText}</Text>
          <Ionicons name="chevron-expand-outline" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>
        {ownerPickerOpen && (
          <View style={styles.pickerList}>
            {owners.map(o => (
              <TouchableOpacity
                key={`${o.userId ?? 'label'}-${o.name}`}
                style={styles.pickerOption}
                onPress={() => {
                  patch({ owner_user_id: o.userId, owner_label: o.userId ? null : o.name });
                  setOwnerPickerOpen(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerOptionText}>{o.name}</Text>
                {!!o.calling && <Text style={styles.pickerOptionSub}>{o.calling}</Text>}
              </TouchableOpacity>
            ))}
            {/* Leaders without a Magnify account still have to be assignable —
                they land in owner_label instead of owner_user_id. */}
            <View style={styles.pickerOption}>
              <Text style={styles.pickerOptionSub}>{t('dash.edit.customOwner')}</Text>
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={merged!.owner_user_id ? '' : (merged!.owner_label ?? '')}
                onChangeText={v => patch({ owner_label: v, owner_user_id: null })}
                placeholder={t('dash.edit.customOwnerPlaceholder')}
                placeholderTextColor={Colors.gray[400]}
              />
            </View>
          </View>
        )}

        <Text style={styles.fieldLabel}>{t('dash.edit.dueLabel')}</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepper} onPress={() => shiftDue(-1)} activeOpacity={0.8}>
            <Ionicons name="remove" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <Text style={styles.pickerValue}>
              {merged!.due_on ? formatLongDate(merged!.due_on, language) : t('dash.sheet.noDueDate')}
            </Text>
          </View>
          <TouchableOpacity style={styles.stepper} onPress={() => shiftDue(1)} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* A brand-new item is always Open, and the insert doesn't send a
            status — showing a picker here would let the UI claim something the
            write ignores. */}
        {!createMode && (
          <>
            <Text style={styles.fieldLabel}>{t('dash.edit.statusLabel')}</Text>
            <TouchableOpacity style={styles.pickerRow} onPress={cycleStatus} activeOpacity={0.8}>
              <Text style={styles.pickerValue}>{t(STATUS_KEY[merged!.status])}</Text>
              <Ionicons name="chevron-expand-outline" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.fieldLabel}>{t('dash.edit.workstreamLabel')}</Text>
        <TouchableOpacity
          style={[styles.pickerRow, styles.pickerRowTall]}
          onPress={() => setWsPickerOpen(o => !o)}
          activeOpacity={0.8}
        >
          <Text style={[styles.pickerValue, styles.pickerValueWrap]}>{wsName}</Text>
          <Ionicons name="chevron-expand-outline" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>
        {wsPickerOpen && (
          <View style={styles.pickerList}>
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => { patch({ workstream_id: null }); setWsPickerOpen(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerOptionText}>{t('dash.sheet.none')}</Text>
            </TouchableOpacity>
            {workstreams.map(w => (
              <TouchableOpacity
                key={w.id}
                style={styles.pickerOption}
                onPress={() => { patch({ workstream_id: w.id }); setWsPickerOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={styles.pickerOptionText}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>
            {createMode ? t('dash.edit.createItem') : t('dash.edit.saveChanges')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.confidential}>{t('dash.sheet.confidential')}</Text>
      </>
    );
  }
}

function kindKey(item: DashboardItem): TranslationKey {
  return (`dash.kind.${item.kind}` as TranslationKey);
}

function FieldRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.fieldRow, last && styles.fieldRowLast]}>
      <Text style={styles.fieldKey}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // The height cap lives HERE, not on the sheet. A percentage max-height only
  // resolves against a parent with a definite height; on the sheet itself
  // (whose parent was content-sized) it was ignored and a tall sheet ran off
  // the bottom of the screen, clipping Mark Done.
  sheetWrap: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
  },
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
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  scroll: { flexShrink: 1 },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.gray[200],
    alignSelf: 'center',
    marginBottom: 14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  titleCol: { flex: 1 },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.gray[900],
    letterSpacing: -0.3,
  },
  titleSub: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  editBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  editedNote: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.success,
    marginTop: 6,
  },
  fieldList: {
    backgroundColor: Colors.gray[100],
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginTop: 14,
    gap: 1,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  fieldRowLast: {},
  fieldKey: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
  },
  fieldValue: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray[800],
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  secondaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  confidential: {
    fontSize: 10,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 14,
  },

  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  editTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  cancel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[500],
  },
  saveLink: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[500],
    letterSpacing: 0.3,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    fontSize: FontSize.md,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  inlineInput: {
    marginTop: 6,
  },
  pickerRow: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Colors.white,
  },
  pickerRowTall: {
    height: undefined,
    minHeight: 48,
    paddingVertical: 10,
  },
  pickerValue: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.gray[900],
  },
  pickerValueWrap: {
    flexShrink: 1,
  },
  pickerList: {
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    marginTop: 6,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  pickerOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray[800],
  },
  pickerOptionSub: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  stepperValue: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
