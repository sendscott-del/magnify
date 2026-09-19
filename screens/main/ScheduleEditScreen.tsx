import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DrillHeader } from '../../components/dashboard/DrillHeader';
import { Button } from '../../components/ui/Button';
import { Toast } from '../../components/dashboard/Toast';
import { cardBase } from '../../components/dashboard/primitives';
import {
  MEETING_BODIES, MeetingBody, MeetingFormat, SEATS, Seat, WEEK_KINDS, WeekKind,
  buildTimeline, bodiesForRole, fmtClock, formatSundayLong, quarterOf, toHHMM, toMinutes,
} from '../../lib/schedule';
import { ReferenceData, WeekBundle, loadReference, loadWeek, saveWeek } from '../../lib/scheduleData';
import { useDemoMode, isReviewDemoUser } from '../../context/DemoModeContext';
import { DEMO_SUNDAY } from '../../lib/demoSchedule';

type T = (key: TranslationKey) => string;

interface MeetingRow { key: string; body: MeetingBody; starts_at: string; ends_at: string; format: MeetingFormat; label: string }

/**
 * Edit Sunday — Settings → Meeting schedule → a Sunday, or "Edit Sunday" on
 * the This Sunday card.
 *
 * Field order is the point: kind of Sunday, then building assignments FIRST
 * (the Saturday-night edit is "change the P column"), then meetings, then
 * companion, then Save. Notes are presidency-only and sit under Save.
 */
export function ScheduleEditScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const sundayISO: string = route.params?.sunday;
  const { profile, isPresidency } = useAuth();
  const { demoMode } = useDemoMode();
  const { t, language } = useLanguage();
  // The demo edits fixtures in memory and never writes; RLS would refuse anyway.
  const isDemo = demoMode || isReviewDemoUser(profile?.email) || profile?.is_demo === true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ref, setRef] = useState<ReferenceData | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [kind, setKind] = useState<WeekKind>('meetings');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [assignments, setAssignments] = useState<Record<Seat, string[]>>({ P: [], '1C': [], '2C': [] });
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [companion, setCompanion] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<{ type: 'seat'; seat: Seat } | { type: 'companion' } | { type: 'body'; key: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = isDemo ? DEMO_SUNDAY.reference : await loadReference();
      const names: Record<string, string> = {};
      for (const m of r.hcMembers) names[m.id] = m.name;
      const b: WeekBundle = isDemo ? DEMO_SUNDAY.bundle(sundayISO) : await loadWeek(sundayISO, names);
      if (!alive) return;
      setRef(r);
      setWeekId(b.week?.id ?? null);
      setKind(b.week?.kind ?? 'meetings');
      setHolidayLabel(b.week?.holiday_label ?? '');
      const a: Record<Seat, string[]> = { P: [], '1C': [], '2C': [] };
      for (const row of b.assignments) a[row.seat].push(row.ward_id);
      setAssignments(a);
      setMeetings(b.meetings.map(m => ({
        key: m.id, body: m.body, starts_at: m.starts_at.slice(0, 5), ends_at: m.ends_at.slice(0, 5), format: m.format, label: m.label ?? '',
      })));
      setCompanion(b.rotation?.hc_member_id ?? null);
      setReason(b.rotation?.reason ?? '');
      setNote(b.note);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sundayISO, isDemo]);

  const wardName = (id: string) => ref?.wards.find(w => w.id === id)?.name ?? '';

  // Per-seat conflict preview, so a clashing P column shows red before Save.
  const seatConflicts = useMemo(() => {
    const out: Record<Seat, string | null> = { P: null, '1C': null, '2C': null };
    if (!ref) return out;
    const wardNames: Record<string, string> = {};
    for (const w of ref.wards) wardNames[w.id] = w.name;
    for (const seat of SEATS) {
      const tl = buildTimeline({
        week: { id: weekId ?? 'draft', sunday_on: sundayISO, kind, holiday_label: holidayLabel || null },
        meetings: meetings.map((m, i) => ({ id: m.key, week_id: weekId ?? 'draft', body: m.body, starts_at: m.starts_at, ends_at: m.ends_at, format: m.format, label: m.label || null, sort_order: i })),
        wardIds: assignments[seat],
        wardNames,
        wardTimes: ref.wardTimes,
        buildings: ref.buildings,
        travel: ref.travel,
        settings: ref.settings,
        bodiesFor: bodiesForRole('stake_president'),
        t,
      });
      out[seat] = tl.conflicts[0] ?? null;
    }
    return out;
  }, [ref, assignments, meetings, kind, holidayLabel, sundayISO, weekId, t]);

  function seatMeta(seat: Seat): string {
    const ids = assignments[seat];
    if (!ids.length) return t('schedule.edit.noWard');
    if (!ref) return '';
    return ids.map(id => {
      const wt = ref.wardTimes.find(w => w.ward_id === id);
      return wt ? `${fmtClock(toMinutes(wt.sacrament_at))} ${t('schedule.sacrament')}` : t('schedule.conflict.noTime');
    }).join(' · ');
  }

  function toggleWard(seat: Seat, wardId: string) {
    setAssignments(prev => {
      const has = prev[seat].includes(wardId);
      return { ...prev, [seat]: has ? prev[seat].filter(x => x !== wardId) : [...prev[seat], wardId] };
    });
  }

  function addMeeting() {
    const last = meetings[meetings.length - 1];
    const start = last ? toMinutes(last.ends_at) : 7 * 60;
    setMeetings(prev => [...prev, {
      key: `new-${Date.now()}`, body: 'SP', starts_at: toHHMM(start), ends_at: toHHMM(start + 30), format: 'in_person', label: '',
    }]);
  }

  function updateMeeting(key: string, patch: Partial<MeetingRow>) {
    setMeetings(prev => prev.map(m => (m.key === key ? { ...m, ...patch } : m)));
  }

  function shiftTime(key: string, field: 'starts_at' | 'ends_at', delta: number) {
    setMeetings(prev => prev.map(m => {
      if (m.key !== key) return m;
      const v = Math.max(0, Math.min(23 * 60 + 45, toMinutes(m[field]) + delta));
      const next = { ...m, [field]: toHHMM(v) };
      if (toMinutes(next.ends_at) <= toMinutes(next.starts_at)) {
        if (field === 'starts_at') next.ends_at = toHHMM(v + 30);
        else next.starts_at = toHHMM(v - 30);
      }
      return next;
    }));
  }

  async function save() {
    if (isDemo) { nav.goBack(); return; }
    setSaving(true);
    const res = await saveWeek({
      id: weekId,
      sunday_on: sundayISO,
      kind,
      holiday_label: holidayLabel.trim() || null,
      meetings: meetings.map(m => ({ body: m.body, starts_at: m.starts_at, ends_at: m.ends_at, format: m.format, label: m.label.trim() || null })),
      assignments: SEATS.flatMap(seat => assignments[seat].map(ward_id => ({ seat, ward_id }))),
      hc_member_id: companion,
      reason: reason.trim() || null,
      note,
      canWriteNote: isPresidency,
    });
    setSaving(false);
    if (res.error) { setToast(`${t('schedule.edit.saveFailed')}: ${res.error}`); return; }
    setWeekId(res.weekId);
    nav.goBack();
  }

  if (loading || !ref) {
    return <View style={styles.loading}><ActivityIndicator color={Colors.primary} /></View>;
  }

  const quarter = quarterOf(sundayISO);

  return (
    <View style={styles.root}>
      <DrillHeader
        title={formatSundayLong(sundayISO, language)}
        subtitle={`${t('schedule.title')} · Q${quarter}`}
        onBack={() => nav.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 1. Kind of Sunday */}
        <Text style={styles.label}>{t('schedule.edit.kind')}</Text>
        <View style={styles.pills}>
          {WEEK_KINDS.map(k => (
            <TouchableOpacity key={k} style={[styles.pill, kind === k && styles.pillOn]} onPress={() => setKind(k)} activeOpacity={0.8}>
              <Text style={[styles.pillText, kind === k && styles.pillTextOn]}>{t(`schedule.kind.${k}` as TranslationKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {(kind === 'holiday' || kind === 'none') && (
          <TextInput
            style={styles.input}
            value={holidayLabel}
            onChangeText={setHolidayLabel}
            placeholder={t('schedule.edit.holidayLabel')}
            placeholderTextColor={Colors.gray[400]}
          />
        )}

        {/* 2. Building assignments */}
        <View style={styles.sectionHead}>
          <Text style={styles.label}>{t('schedule.edit.buildings')}</Text>
          <Text style={styles.note}>{t('schedule.edit.tapToChange').toUpperCase()}</Text>
        </View>
        <View style={styles.listCard}>
          {SEATS.map((seat, i) => (
            <TouchableOpacity
              key={seat}
              style={[styles.seatRow, i > 0 && styles.rowDivider]}
              onPress={() => setPicker({ type: 'seat', seat })}
              activeOpacity={0.8}
            >
              <Text style={styles.seatKey}>{seat}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.seatWard}>
                  {assignments[seat].length ? assignments[seat].map(wardName).join(', ') : t('schedule.edit.unassigned')}
                </Text>
                <Text style={[styles.seatMeta, !!seatConflicts[seat] && styles.seatMetaBad]} numberOfLines={2}>
                  {seatConflicts[seat] ?? seatMeta(seat)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* 3. Meetings */}
        <Text style={styles.label}>{t('schedule.edit.meetings')}</Text>
        <View style={styles.listCard}>
          {meetings.map((m, i) => (
            <View key={m.key} style={[styles.meetingRow, i > 0 && styles.rowDivider]}>
              <View style={styles.meetingTop}>
                <TouchableOpacity style={styles.bodyChip} onPress={() => setPicker({ type: 'body', key: m.key })} activeOpacity={0.8}>
                  <Text style={styles.bodyChipText}>{m.body}</Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.gray[600]} />
                </TouchableOpacity>
                <Text style={styles.meetingName} numberOfLines={1}>{t(`schedule.body.${m.body}` as TranslationKey)}</Text>
                <TouchableOpacity onPress={() => setMeetings(prev => prev.filter(x => x.key !== m.key))} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={22} color={Colors.gray[400]} />
                </TouchableOpacity>
              </View>
              <View style={styles.timeRow}>
                <TimeStepper label={fmtClock(toMinutes(m.starts_at))} onDown={() => shiftTime(m.key, 'starts_at', -15)} onUp={() => shiftTime(m.key, 'starts_at', 15)} />
                <Text style={styles.dash}>–</Text>
                <TimeStepper label={fmtClock(toMinutes(m.ends_at))} onDown={() => shiftTime(m.key, 'ends_at', -15)} onUp={() => shiftTime(m.key, 'ends_at', 15)} />
                <TouchableOpacity
                  style={[styles.formatChip, m.format === 'zoom' && styles.formatChipZoom]}
                  onPress={() => updateMeeting(m.key, { format: m.format === 'zoom' ? 'in_person' : 'zoom' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.formatText}>{t(m.format === 'zoom' ? 'schedule.format.zoom' : 'schedule.format.inPerson')}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.labelInput}
                value={m.label}
                onChangeText={v => updateMeeting(m.key, { label: v })}
                placeholder={t('schedule.edit.meetingLabel')}
                placeholderTextColor={Colors.gray[400]}
              />
            </View>
          ))}
          <TouchableOpacity style={[styles.addRow, meetings.length > 0 && styles.rowDivider]} onPress={addMeeting} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addText}>{t('schedule.edit.addMeeting')}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Companion */}
        <Text style={styles.label}>{t('sunday.companion')}</Text>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'companion' })} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldText}>
              {companion ? ref.hcMembers.find(m => m.id === companion)?.name ?? '' : t('schedule.edit.noCompanion')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
        </TouchableOpacity>
        {!!companion && (
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t('schedule.edit.companionReason')}
            placeholderTextColor={Colors.gray[400]}
          />
        )}

        {/* 5. Save */}
        <Button title={t('schedule.edit.save')} onPress={save} variant="primary" fullWidth loading={saving} style={styles.save} textStyle={{ fontSize: FontSize.lg }} />

        {isPresidency && (
          <>
            <Text style={styles.label}>{t('schedule.edit.notes')}</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={t('schedule.edit.notesHint')}
              placeholderTextColor={Colors.gray[400]}
            />
          </>
        )}
      </ScrollView>

      {/* Pickers */}
      <Picker
        visible={picker?.type === 'seat'}
        title={picker?.type === 'seat' ? `${picker.seat} · ${t('schedule.edit.pickWards')}` : ''}
        options={ref.wards.map(w => ({ id: w.id, label: w.name, sub: (() => { const wt = ref.wardTimes.find(x => x.ward_id === w.id); return wt ? `${fmtClock(toMinutes(wt.sacrament_at))} · ${ref.buildings.find(b => b.id === wt.building_id)?.short_name ?? ''}` : ''; })() }))}
        selected={picker?.type === 'seat' ? assignments[picker.seat] : []}
        multi
        onToggle={id => picker?.type === 'seat' && toggleWard(picker.seat, id)}
        onClose={() => setPicker(null)}
        doneLabel={t('dash.edit.done')}
      />
      <Picker
        visible={picker?.type === 'companion'}
        title={t('sunday.companion')}
        options={[{ id: '', label: t('schedule.edit.noCompanion'), sub: '' }, ...ref.hcMembers.map(m => ({ id: m.id, label: m.name, sub: '' }))]}
        selected={[companion ?? '']}
        onToggle={id => { setCompanion(id || null); setPicker(null); }}
        onClose={() => setPicker(null)}
        doneLabel={t('dash.edit.done')}
      />
      <Picker
        visible={picker?.type === 'body'}
        title={t('schedule.edit.meetingType')}
        options={MEETING_BODIES.map(b => ({ id: b, label: t(`schedule.body.${b}` as TranslationKey), sub: b }))}
        selected={picker?.type === 'body' ? [meetings.find(m => m.key === picker.key)?.body ?? ''] : []}
        onToggle={id => { if (picker?.type === 'body') updateMeeting(picker.key, { body: id as MeetingBody }); setPicker(null); }}
        onClose={() => setPicker(null)}
        doneLabel={t('dash.edit.done')}
      />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} bottomOffset={0} />}
    </View>
  );
}

function TimeStepper({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={onDown} hitSlop={6} style={styles.stepBtn}><Ionicons name="remove" size={16} color={Colors.primary} /></TouchableOpacity>
      <Text style={styles.stepText}>{label}</Text>
      <TouchableOpacity onPress={onUp} hitSlop={6} style={styles.stepBtn}><Ionicons name="add" size={16} color={Colors.primary} /></TouchableOpacity>
    </View>
  );
}

function Picker({
  visible, title, options, selected, multi, onToggle, onClose, doneLabel,
}: {
  visible: boolean; title: string;
  options: Array<{ id: string; label: string; sub: string }>;
  selected: string[]; multi?: boolean;
  onToggle: (id: string) => void; onClose: () => void; doneLabel: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {options.map(o => {
              const on = selected.includes(o.id);
              return (
                <TouchableOpacity key={o.id || '__none'} style={styles.optRow} onPress={() => onToggle(o.id)} activeOpacity={0.8}>
                  <Ionicons name={on ? (multi ? 'checkbox' : 'radio-button-on') : (multi ? 'square-outline' : 'radio-button-off')} size={20} color={on ? Colors.primary : Colors.gray[400]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{o.label}</Text>
                    {!!o.sub && <Text style={styles.optSub}>{o.sub}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {multi && <Button title={doneLabel} onPress={onClose} variant="primary" fullWidth style={{ marginTop: 8 }} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gray[50] },
  scroll: { padding: Spacing.md, gap: 10, paddingBottom: 40 },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[700], marginTop: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  note: { fontSize: 10, fontWeight: '700', color: Colors.gray[400], letterSpacing: 0.5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 44, paddingHorizontal: 14, justifyContent: 'center',
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray[200], backgroundColor: Colors.white,
  },
  pillOn: { backgroundColor: Colors.primaryFade, borderColor: Colors.primary },
  pillText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[500] },
  pillTextOn: { color: Colors.primary },
  input: {
    ...cardBase, minHeight: 48, paddingHorizontal: 12, fontSize: FontSize.md, color: Colors.gray[900], borderWidth: 1.5,
  },
  notes: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  listCard: { ...cardBase },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  seatKey: { width: 34, fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary },
  seatWard: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  seatMeta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  seatMetaBad: { color: Colors.error, fontWeight: '600' },
  meetingRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  meetingTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bodyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gray[100], borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  bodyChipText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.gray[700] },
  meetingName: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md, backgroundColor: Colors.white },
  stepBtn: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { minWidth: 48, textAlign: 'center', fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[900] },
  dash: { color: Colors.gray[400] },
  formatChip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.primaryFade },
  formatChipZoom: { backgroundColor: '#EFF6FF' },
  formatText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  labelInput: { fontSize: FontSize.sm, color: Colors.gray[800], paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12 },
  addText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  field: { ...cardBase, borderWidth: 1.5, minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldText: { fontSize: FontSize.md, color: Colors.gray[900] },
  save: { minHeight: 48, marginTop: 8 },
  scrim: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'center', padding: 16 },
  pickerSheet: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  pickerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  optLabel: { fontSize: FontSize.md, color: Colors.gray[900], fontWeight: '600' },
  optSub: { fontSize: FontSize.xs, color: Colors.gray[500] },
});
