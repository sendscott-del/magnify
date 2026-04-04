import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, ActivityIndicator, FlatList, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Calling, CallingLogEntry, WardSustaining, Ward, Stage, Profile } from '../../lib/database.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { STAGE_LABELS } from '../../constants/callings';
import {
  canAdvanceStage, canReject, canMoveback, canDelete,
  getNextStage, getPrevStage, getAdvanceLabel,
} from '../../lib/permissions';
import { notifyStageChange, notifyRejection } from '../../lib/slack';

// TYPE_LABELS is built inside CallingDetailScreen using t()
const TYPE_COLORS: Record<string, string> = {
  ward_calling: Colors.info,
  stake_calling: '#8B5CF6',
  mp_ordination: Colors.success,
};
const TYPE_ICONS: Record<string, any> = {
  ward_calling: require('../../assets/icon_ward.png'),
  stake_calling: require('../../assets/icon_stake.png'),
  mp_ordination: require('../../assets/icon_mp.png'),
};

// SP roles in order — stake_clerk and exec_secretary are optional (informational only)
// Labels are injected via t() inside each component that renders them
const SP_ROLES = [
  { role: 'stake_president', required: true },
  { role: 'first_counselor', required: true },
  { role: 'second_counselor', required: true },
  { role: 'stake_clerk', required: false },
  { role: 'exec_secretary', required: false },
];

function formatDate(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return d; }
}
function formatDateTime(d?: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM d, yyyy h:mm a'); } catch { return d; }
}

// ─── Ward Sustaining ─────────────────────────────────────────────────────────
function WardSustainingSection({ wards, sustainings, canToggle, onToggle }: {
  wards: Ward[]; sustainings: WardSustaining[]; canToggle: boolean;
  onToggle: (wardId: string, existing: WardSustaining | undefined) => Promise<void>;
}) {
  const { t } = useLanguage();
  return (
    <View style={wsStyles.container}>
      <Text style={wsStyles.title}>{t('detail.wardSustainings')}</Text>
      <View style={wsStyles.grid}>
        {wards.map(ward => {
          const s = sustainings.find(sx => sx.ward_id === ward.id);
          const isSustained = s?.sustained ?? false;
          return (
            <TouchableOpacity key={ward.id} style={[wsStyles.chip, isSustained && wsStyles.chipOn]} onPress={() => onToggle(ward.id, s)} disabled={!canToggle}>
              <Text style={[wsStyles.chipLabel, isSustained && wsStyles.chipLabelOn]}>{ward.abbreviation}</Text>
              {isSustained && s?.sustained_at && <Text style={wsStyles.chipDate}>{format(new Date(s.sustained_at), 'M/d')}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={wsStyles.hint}>{sustainings.filter(s => s.sustained).length}/{wards.length} {t('detail.wardsSustained')}</Text>
    </View>
  );
}
const wsStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.gray[300], backgroundColor: Colors.gray[50], alignItems: 'center', minWidth: 44 },
  chipOn: { borderColor: Colors.success, backgroundColor: Colors.success + '15' },
  chipLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gray[600] },
  chipLabelOn: { color: Colors.success },
  chipDate: { fontSize: 9, color: Colors.success, fontWeight: '600', marginTop: 1 },
  hint: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs },
});

// ─── SP Approval ─────────────────────────────────────────────────────────────
interface SPApproval { id: string; calling_id: string; role: string; approved: boolean; approved_at: string | null; approved_by: string | null; }

function StakePresidencyApprovalSection({ callingId, approvals, canToggle, userRole, onToggle, showOverrideNote }: {
  callingId: string; approvals: SPApproval[]; canToggle: boolean; userRole?: string; onToggle: (role: string, current: boolean) => Promise<void>; showOverrideNote?: boolean;
}) {
  const { t } = useLanguage();
  const SP_ROLES_LABELED = [
    { role: 'stake_president', label: t('role.stake_president'), required: true },
    { role: 'first_counselor', label: t('role.first_counselor'), required: true },
    { role: 'second_counselor', label: t('role.second_counselor'), required: true },
    { role: 'stake_clerk', label: t('role.stake_clerk'), required: false },
    { role: 'exec_secretary', label: t('role.exec_secretary'), required: false },
  ];
  const presidentApproved = approvals.find(a => a.role === 'stake_president')?.approved ?? false;
  const requiredApproved = SP_ROLES.filter(r => r.required).every(r => approvals.find(a => a.role === r.role)?.approved ?? false);
  const approvedCount = SP_ROLES.filter(r => r.required && (approvals.find(a => a.role === r.role)?.approved ?? false)).length;
  const isReady = presidentApproved || requiredApproved;

  return (
    <View style={spStyles.container}>
      <Text style={spStyles.title}>{t('detail.stakePresidencyApproval')}</Text>
      {SP_ROLES_LABELED.map(({ role, label, required }) => {
        const rec = approvals.find(a => a.role === role);
        const isApproved = rec?.approved ?? false;
        const canCheck = canToggle && (userRole === role || userRole === 'stake_president' || userRole === 'stake_clerk' || userRole === 'exec_secretary');
        return (
          <TouchableOpacity key={role} style={spStyles.row} onPress={() => canCheck ? onToggle(role, isApproved) : undefined} disabled={!canCheck}>
            <View style={[spStyles.checkbox, isApproved && spStyles.checkboxOn]}>
              {isApproved && <Text style={spStyles.checkMark}>✓</Text>}
            </View>
            <Text style={[spStyles.label, !required && spStyles.labelOptional]}>{label}{!required ? ` ${t('detail.optional')}` : ''}</Text>
            {isApproved && rec?.approved_at && <Text style={spStyles.date}>{format(new Date(rec.approved_at), 'M/d')}</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={[spStyles.status, isReady && spStyles.statusReady]}>
        {approvedCount}/3 {t('detail.approved')}
        {presidentApproved ? ` — ${t('detail.spApproved')}` : requiredApproved ? ` — ${t('detail.allApproved')}` : ` — ${t('detail.awaitingApproval')}`}
      </Text>
      {showOverrideNote && presidentApproved && (
        <View style={spStyles.overrideBanner}>
          <Text style={spStyles.overrideBannerText}>{t('detail.spOverrideApplied')}</Text>
        </View>
      )}
    </View>
  );
}
const spStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.gray[300], marginRight: Spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  label: { flex: 1, fontSize: FontSize.md, color: Colors.gray[700] },
  labelOptional: { color: Colors.gray[500], fontStyle: 'italic' },
  date: { fontSize: FontSize.xs, color: Colors.gray[400] },
  status: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs, fontStyle: 'italic' },
  statusReady: { color: Colors.success, fontWeight: '600', fontStyle: 'normal' },
  overrideBanner: { marginTop: Spacing.sm, backgroundColor: Colors.success + '15', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.success + '40' },
  overrideBannerText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },
});

// ─── HC Approval ─────────────────────────────────────────────────────────────
interface HCMember { id: string; name: string; sort_order: number; active: boolean; }
interface HCApproval { id: string; calling_id: string; hc_member_id: string; approved: boolean; approved_at: string | null; }

function HCApprovalSection({ hcMembers, hcApprovals, canToggle, spOverride, onToggle }: {
  hcMembers: HCMember[]; hcApprovals: HCApproval[]; canToggle: boolean; spOverride: boolean; onToggle: (memberId: string, current: boolean) => Promise<void>;
}) {
  const { t } = useLanguage();
  const activeMembers = hcMembers.filter(m => m.active);
  const approvedCount = hcApprovals.filter(a => a.approved).length;
  const needed = Math.ceil(activeMembers.length / 2);
  const isReady = spOverride || activeMembers.length === 0 || approvedCount >= needed;

  if (activeMembers.length === 0) {
    return (
      <View style={hcStyles.container}>
        <Text style={hcStyles.title}>{t('detail.highCouncilApproval')}</Text>
        <Text style={hcStyles.empty}>{t('detail.noHCConfigured')}</Text>
      </View>
    );
  }

  return (
    <View style={hcStyles.container}>
      <View style={hcStyles.titleRow}>
        <Text style={hcStyles.title}>{t('detail.highCouncilApproval')}</Text>
        {spOverride && <View style={hcStyles.overrideBadge}><Text style={hcStyles.overrideBadgeText}>{t('detail.spOverride')}</Text></View>}
      </View>
      {activeMembers.map(member => {
        const rec = hcApprovals.find(a => a.hc_member_id === member.id);
        const isApproved = rec?.approved ?? false;
        return (
          <TouchableOpacity key={member.id} style={hcStyles.row} onPress={() => canToggle ? onToggle(member.id, isApproved) : undefined} disabled={!canToggle}>
            <View style={[hcStyles.checkbox, isApproved && hcStyles.checkboxOn]}>
              {isApproved && <Text style={hcStyles.checkMark}>✓</Text>}
            </View>
            <Text style={hcStyles.label}>{member.name}</Text>
            {isApproved && rec?.approved_at && <Text style={hcStyles.date}>{format(new Date(rec.approved_at), 'M/d')}</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={[hcStyles.status, isReady && hcStyles.statusReady]}>
        {spOverride
          ? `${t('detail.spApproved')} — ${t('detail.hcThresholdMet')}`
          : `${approvedCount}/${activeMembers.length} ${t('detail.hcApproved')} — ${t('detail.hcNeeded')} ${needed}${isReady ? ` — ${t('detail.hcThresholdMet')}` : ` — ${t('detail.hcAwaitingVotes')}`}`}
      </Text>
      {spOverride && (
        <View style={hcStyles.overrideBanner}>
          <Text style={hcStyles.overrideBannerText}>{t('detail.spOverrideApplied')}</Text>
        </View>
      )}
    </View>
  );
}
const hcStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  overrideBadge: { backgroundColor: Colors.primary + '15', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '40' },
  overrideBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  empty: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.gray[300], marginRight: Spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  checkboxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  label: { flex: 1, fontSize: FontSize.md, color: Colors.gray[700] },
  date: { fontSize: FontSize.xs, color: Colors.gray[400] },
  status: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs, fontStyle: 'italic' },
  statusReady: { color: Colors.success, fontWeight: '600', fontStyle: 'normal' },
  overrideBanner: { marginTop: Spacing.sm, backgroundColor: Colors.success + '15', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.success + '40' },
  overrideBannerText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },
});

// ─── Notes ───────────────────────────────────────────────────────────────────
function NotesSection({ notes, canEdit, onSave }: { notes: string; canEdit: boolean; onSave: (text: string) => Promise<void>; }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <View style={notesStyles.container}>
      <View style={notesStyles.header}>
        <Text style={notesStyles.title}>{t('detail.notes')}</Text>
        {canEdit && !editing && (
          <TouchableOpacity onPress={() => { setDraft(notes); setEditing(true); }}>
            <Text style={notesStyles.editBtn}>{t('detail.edit')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {editing ? (
        <>
          <TextInput
            style={notesStyles.input}
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={t('detail.addNotes')}
            autoFocus
          />
          <View style={notesStyles.btnRow}>
            <TouchableOpacity style={notesStyles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={notesStyles.cancelText}>{t('detail.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={notesStyles.saveBtn} onPress={save} disabled={saving}>
              <Text style={notesStyles.saveText}>{saving ? t('detail.saving') : t('detail.save')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={notes ? notesStyles.notesText : notesStyles.placeholder}>
          {notes || (canEdit ? t('detail.addNotes') : t('detail.noNotes'))}
        </Text>
      )}
    </View>
  );
}
const notesStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  editBtn: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  notesText: { fontSize: FontSize.sm, color: Colors.gray[700], lineHeight: 20 },
  placeholder: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  input: { fontSize: FontSize.sm, color: Colors.gray[800], borderWidth: 1, borderColor: Colors.gray[300], borderRadius: Radius.sm, padding: Spacing.sm, minHeight: 80, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gray[300] },
  cancelText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  saveBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: Colors.primary },
  saveText: { fontSize: FontSize.sm, color: Colors.white, fontWeight: '600' },
});

// ─── Release Member ──────────────────────────────────────────────────────────
function ReleaseMemberSection({ calling, wards, canEdit, onSave, onToggleDone }: {
  calling: Calling; wards: Ward[]; canEdit: boolean;
  onSave: (name: string, currentCalling: string, wardId: string) => Promise<void>;
  onToggleDone: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(calling.release_member_name ?? '');
  const [currentCalling, setCurrentCalling] = useState(calling.release_current_calling ?? '');
  const [wardId, setWardId] = useState(calling.release_ward_id ?? '');
  const [wardName, setWardName] = useState(wards.find(w => w.id === (calling.release_ward_id ?? ''))?.name ?? '');
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const hasData = !!(calling.release_member_name || calling.release_current_calling);

  async function save() {
    setSaving(true);
    await onSave(name, currentCalling, wardId);
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setName(calling.release_member_name ?? '');
    setCurrentCalling(calling.release_current_calling ?? '');
    setWardId(calling.release_ward_id ?? '');
    setWardName(wards.find(w => w.id === (calling.release_ward_id ?? ''))?.name ?? '');
    setEditing(false);
  }

  return (
    <View style={rmStyles.container}>
      <View style={rmStyles.header}>
        <View style={rmStyles.titleRow}>
          <Ionicons name="person-remove-outline" size={16} color={Colors.warning} style={{ marginRight: 6 }} />
          <Text style={rmStyles.title}>{t('release.sectionTitle')}</Text>
          {!hasData && !editing && <Text style={rmStyles.optionalTag}>{t('detail.optional')}</Text>}
        </View>
        {canEdit && !editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={rmStyles.editBtn}>{hasData ? t('release.edit') : t('release.add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <>
          <TextInput
            style={rmStyles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('release.memberNamePlaceholder')}
            autoFocus
          />
          <TextInput
            style={rmStyles.input}
            value={currentCalling}
            onChangeText={setCurrentCalling}
            placeholder={t('release.currentCallingPlaceholder')}
          />
          <TouchableOpacity style={rmStyles.wardBtn} onPress={() => setShowWardPicker(true)}>
            <Text style={wardId ? rmStyles.wardBtnText : rmStyles.wardBtnPlaceholder}>
              {wardId ? wardName : 'Select ward (optional)'}
            </Text>
            <Text style={rmStyles.wardArrow}>▼</Text>
          </TouchableOpacity>
          <View style={rmStyles.btnRow}>
            <TouchableOpacity style={rmStyles.cancelBtn} onPress={cancel}>
              <Text style={rmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={rmStyles.saveBtn} onPress={save} disabled={saving}>
              <Text style={rmStyles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={showWardPicker} transparent animationType="slide" onRequestClose={() => setShowWardPicker(false)}>
            <TouchableOpacity style={rmStyles.modalOverlay} activeOpacity={1} onPress={() => setShowWardPicker(false)}>
              <View style={rmStyles.modalSheet} onStartShouldSetResponder={() => true}>
                <Text style={rmStyles.modalTitle}>{t('release.selectWardTitle')}</Text>
                <TouchableOpacity
                  style={[rmStyles.modalItem, !wardId && rmStyles.modalItemSelected]}
                  onPress={() => { setWardId(''); setWardName(''); setShowWardPicker(false); }}
                >
                  <Text style={[rmStyles.modalItemText, !wardId && rmStyles.modalItemTextSelected]}>{t('release.noWard')}</Text>
                </TouchableOpacity>
                <FlatList
                  data={wards}
                  keyExtractor={w => w.id}
                  renderItem={({ item: w }) => (
                    <TouchableOpacity
                      style={[rmStyles.modalItem, wardId === w.id && rmStyles.modalItemSelected]}
                      onPress={() => { setWardId(w.id); setWardName(w.name); setShowWardPicker(false); }}
                    >
                      <Text style={[rmStyles.modalItemText, wardId === w.id && rmStyles.modalItemTextSelected]}>{w.name}</Text>
                      <Text style={rmStyles.modalItemSub}>{w.abbreviation}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      ) : hasData ? (
        <View style={rmStyles.dataView}>
          <Text style={rmStyles.dataName}>{calling.release_member_name}</Text>
          {calling.release_current_calling ? <Text style={rmStyles.dataCalling}>{calling.release_current_calling}</Text> : null}
          {calling.release_ward_id ? (
            <Text style={rmStyles.dataWard}>{wards.find(w => w.id === calling.release_ward_id)?.name ?? ''}</Text>
          ) : null}
          <TouchableOpacity
            style={rmStyles.doneRow}
            onPress={async () => {
              if (!canEdit || toggling) return;
              setToggling(true);
              await onToggleDone();
              setToggling(false);
            }}
            disabled={!canEdit || toggling}
          >
            <View style={[rmStyles.doneCheck, calling.release_done && rmStyles.doneCheckOn]}>
              {calling.release_done && <Text style={rmStyles.doneCheckMark}>✓</Text>}
            </View>
            <Text style={[rmStyles.doneLabel, calling.release_done && rmStyles.doneLabelOn]}>
              {calling.release_done ? t('release.released') : t('release.markAsReleased')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={rmStyles.placeholder}>{canEdit ? 'No release member entered. Tap Add to add one.' : 'No release required.'}</Text>
      )}
    </View>
  );
}
const rmStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '50' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  optionalTag: { marginLeft: Spacing.sm, fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  editBtn: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  dataView: { gap: 2 },
  dataName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  dataCalling: { fontSize: FontSize.sm, color: Colors.gray[600] },
  dataWard: { fontSize: FontSize.sm, color: Colors.gray[400], marginTop: 2 },
  doneRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: Spacing.xs },
  doneCheck: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: Colors.gray[300], backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  doneCheckOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  doneCheckMark: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  doneLabel: { fontSize: FontSize.sm, color: Colors.gray[500] },
  doneLabelOn: { color: Colors.success, fontWeight: '700' },
  placeholder: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  input: { fontSize: FontSize.sm, color: Colors.gray[800], borderWidth: 1, borderColor: Colors.gray[300], borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm },
  wardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.gray[300], borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: Colors.gray[50] },
  wardBtnText: { fontSize: FontSize.sm, color: Colors.gray[800] },
  wardBtnPlaceholder: { fontSize: FontSize.sm, color: Colors.gray[400] },
  wardArrow: { fontSize: 10, color: Colors.gray[400] },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gray[300] },
  cancelText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  saveBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: Colors.primary },
  saveText: { fontSize: FontSize.sm, color: Colors.white, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '60%', paddingTop: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemSub: { fontSize: FontSize.sm, color: Colors.gray[400] },
});

// ─── Task Assignments ─────────────────────────────────────────────────────────
interface Assignee { name: string; subtitle: string; }

function TaskAssignmentsSection({ calling, assignees, clerkName, canEdit, onAssign }: {
  calling: Calling; assignees: Assignee[]; clerkName: string | null; canEdit: boolean;
  onAssign: (field: string, name: string | null) => Promise<void>;
}) {
  const { t } = useLanguage();
  const TASK_FIELDS: { key: string; label: string; locked?: boolean }[] = [
    { key: 'extend_by', label: t('detail.extendCalling') },
    { key: 'sustain_by', label: t('detail.sustain') },
    { key: 'set_apart_by', label: t('detail.setApart') },
    { key: 'record_by', label: t('detail.record'), locked: true },
  ];
  const [pickerField, setPickerField] = useState<string | null>(null);
  const visibleFields = TASK_FIELDS.filter(f => !(f.key === 'extend_by' && calling.type === 'mp_ordination'));

  return (
    <View style={taStyles.container}>
      <Text style={taStyles.title}>{t('detail.taskAssignments')}</Text>
      {visibleFields.map(({ key, label, locked }) => {
        const assignedName = (calling as any)[key] as string | null;
        const isRecord = locked;
        const displayName = isRecord ? (clerkName ?? t('role.stake_clerk')) : assignedName;
        const isFilled = !!displayName && (!isRecord || !!clerkName);
        return (
          <View key={key} style={taStyles.row}>
            <Text style={taStyles.taskLabel}>{label}</Text>
            <TouchableOpacity
              style={[taStyles.assignBtn, isFilled && taStyles.assignBtnFilled]}
              onPress={() => (!isRecord && canEdit) ? setPickerField(key) : undefined}
              disabled={isRecord || !canEdit}
            >
              <Text style={[taStyles.assignBtnText, isFilled && taStyles.assignBtnTextFilled]}>
                {displayName ?? t('detail.assign')}
              </Text>
              {!isRecord && canEdit && <Text style={taStyles.assignArrow}>▼</Text>}
              {isRecord && <Text style={taStyles.lockedIcon}>🔒</Text>}
            </TouchableOpacity>
          </View>
        );
      })}

      <Modal visible={!!pickerField} transparent animationType="slide" onRequestClose={() => setPickerField(null)}>
        <TouchableOpacity style={taStyles.modalOverlay} activeOpacity={1} onPress={() => setPickerField(null)}>
          <View style={taStyles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={taStyles.modalTitle}>{t('detail.assignLabel')} {TASK_FIELDS.find(f => f.key === pickerField)?.label}</Text>
            <TouchableOpacity
              style={taStyles.modalItem}
              onPress={() => { if (pickerField) onAssign(pickerField, null); setPickerField(null); }}
            >
              <Text style={[taStyles.modalItemText, { color: Colors.gray[400] }]}>{t('detail.unassign')}</Text>
            </TouchableOpacity>
            <FlatList
              data={assignees}
              keyExtractor={a => a.name}
              renderItem={({ item: a }) => (
                <TouchableOpacity
                  style={[taStyles.modalItem, (calling as any)[pickerField!] === a.name && taStyles.modalItemSelected]}
                  onPress={() => { if (pickerField) onAssign(pickerField, a.name); setPickerField(null); }}
                >
                  <Text style={[taStyles.modalItemText, (calling as any)[pickerField!] === a.name && taStyles.modalItemTextSelected]}>{a.name}</Text>
                  <Text style={taStyles.modalItemSub}>{a.subtitle}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const taStyles = StyleSheet.create({
  container: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, gap: Spacing.sm },
  taskLabel: { width: 110, fontSize: FontSize.sm, color: Colors.gray[600], fontWeight: '600' },
  assignBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  assignBtnFilled: { borderColor: Colors.primary + '60', backgroundColor: Colors.primaryFade },
  assignBtnText: { fontSize: FontSize.sm, color: Colors.gray[400] },
  assignBtnTextFilled: { color: Colors.primary, fontWeight: '600' },
  assignArrow: { fontSize: 10, color: Colors.gray[400] },
  lockedIcon: { fontSize: 10, color: Colors.gray[400] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '60%', paddingTop: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemSub: { fontSize: FontSize.xs, color: Colors.gray[400], textTransform: 'capitalize' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function CallingDetailScreen({ route, navigation }: any) {
  const { callingId } = route.params;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { t } = useLanguage();

  const TYPE_LABELS: Record<string, string> = {
    ward_calling: t('type.ward_calling'),
    stake_calling: t('type.stake_calling'),
    mp_ordination: t('type.mp_ordination'),
  };

  const SP_ROLE_LABELS: Record<string, string> = {
    stake_president: t('role.stake_president'),
    first_counselor: t('role.first_counselor'),
    second_counselor: t('role.second_counselor'),
  };

  const [calling, setCalling] = useState<Calling | null>(null);
  const [log, setLog] = useState<CallingLogEntry[]>([]);
  const [allWards, setAllWards] = useState<Ward[]>([]);
  const [spApprovals, setSpApprovals] = useState<SPApproval[]>([]);
  const [hcApprovals, setHcApprovals] = useState<HCApproval[]>([]);
  const [hcMembers, setHcMembers] = useState<HCMember[]>([]);
  const [spMembers, setSpMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [wardSustainingsList, setWardSustainingsList] = useState<WardSustaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [callingRes, logRes, wardsRes, spRes, hcMembersRes, hcApprovalsRes, profilesRes, spMembersRes, wardSustRes] = await Promise.all([
      supabase.from('callings').select('*, wards!callings_ward_id_fkey(id,name,abbreviation), profiles!created_by(id,full_name,email,role,status,created_at)').eq('id', callingId).single(),
      supabase.from('calling_log').select('*, profiles!performed_by(id,full_name,email,role,status,created_at)').eq('calling_id', callingId).order('created_at', { ascending: false }),
      supabase.from('wards').select('*').order('name'),
      supabase.from('stake_presidency_approvals').select('*').eq('calling_id', callingId),
      supabase.from('high_council_members').select('*').eq('active', true).order('sort_order'),
      supabase.from('hc_approvals').select('*').eq('calling_id', callingId),
      supabase.from('profiles').select('id,full_name,role,status,email,created_at').eq('status', 'approved').order('full_name'),
      supabase.from('sp_members').select('id,name,role').eq('active', true).order('sort_order'),
      supabase.from('ward_sustainings').select('*').eq('calling_id', callingId),
    ]);
    if (callingRes.error) console.error('callingRes error:', JSON.stringify(callingRes.error));
    setCalling(callingRes.data as Calling ?? null);
    setLog((logRes.data as CallingLogEntry[]) ?? []);
    setAllWards((wardsRes.data as Ward[]) ?? []);
    setSpApprovals((spRes.data as SPApproval[]) ?? []);
    setHcMembers((hcMembersRes.data as HCMember[]) ?? []);
    setHcApprovals((hcApprovalsRes.data as HCApproval[]) ?? []);
    setAllProfiles((profilesRes.data as Profile[]) ?? []);
    setSpMembers((spMembersRes.data as any[]) ?? []);
    setWardSustainingsList((wardSustRes.data as WardSustaining[]) ?? []);
    setLoading(false);
  }, [callingId]);

  useFocusEffect(useCallback(() => {
    fetchData();
    // Mark this calling as viewed by the current user
    if (profile?.id) {
      supabase.from('calling_views').upsert(
        { calling_id: callingId, user_id: profile.id },
        { onConflict: 'calling_id,user_id' }
      ).then(() => {});
    }
  }, [fetchData, callingId, profile?.id]));

  async function toggleSPApproval(role: string, current: boolean) {
    const newVal = !current;
    await supabase.from('stake_presidency_approvals').upsert({
      calling_id: callingId, role, approved: newVal,
      approved_at: newVal ? new Date().toISOString() : null,
      approved_by: profile?.id ?? null,
    }, { onConflict: 'calling_id,role' });
    setSpApprovals(prev => {
      const exists = prev.find(a => a.role === role);
      if (exists) return prev.map(a => a.role === role ? { ...a, approved: newVal, approved_at: newVal ? new Date().toISOString() : null } : a);
      return [...prev, { id: '', calling_id: callingId, role, approved: newVal, approved_at: newVal ? new Date().toISOString() : null, approved_by: profile?.id ?? null }];
    });
  }

  async function toggleHCApproval(memberId: string, current: boolean) {
    const newVal = !current;
    await supabase.from('hc_approvals').upsert({
      calling_id: callingId, hc_member_id: memberId, approved: newVal,
      approved_at: newVal ? new Date().toISOString() : null,
    }, { onConflict: 'calling_id,hc_member_id' });
    setHcApprovals(prev => {
      const exists = prev.find(a => a.hc_member_id === memberId);
      if (exists) return prev.map(a => a.hc_member_id === memberId ? { ...a, approved: newVal, approved_at: newVal ? new Date().toISOString() : null } : a);
      return [...prev, { id: '', calling_id: callingId, hc_member_id: memberId, approved: newVal, approved_at: newVal ? new Date().toISOString() : null }];
    });
  }

  async function handleAssign(field: string, name: string | null) {
    if (!calling) return;
    await supabase.from('callings').update({ [field]: name }).eq('id', calling.id);
    setCalling(prev => prev ? { ...prev, [field]: name } : prev);
  }

  async function handleWardSustainingToggle(wardId: string, existing: WardSustaining | undefined) {
    if (!calling) return;
    if (existing) {
      const nv = !existing.sustained;
      await supabase.from('ward_sustainings').update({ sustained: nv, sustained_at: nv ? new Date().toISOString() : null, sustained_by: profile?.id ?? null }).eq('id', existing.id);
    } else {
      await supabase.from('ward_sustainings').insert({ calling_id: calling.id, ward_id: wardId, sustained: true, sustained_at: new Date().toISOString(), sustained_by: profile?.id ?? null });
    }
    const { data } = await supabase.from('ward_sustainings').select('*').eq('calling_id', calling.id);
    setWardSustainingsList((data as WardSustaining[]) ?? []);
  }

  function approvalsReady(userRole: string): boolean {
    if (!calling) return false;
    if (calling.stage === 'for_approval') {
      // Stake President can advance unilaterally
      if (userRole === 'stake_president') return true;
      // All others (1st/2nd counselor, stake clerk) need all three required SP members to have approved
      return SP_ROLES.filter(r => r.required).every(r => spApprovals.find(a => a.role === r.role)?.approved ?? false);
    }
    if (calling.stage === 'hc_approval') {
      // SP, counselors, and stake clerk can advance at any time
      if (['stake_president', 'first_counselor', 'second_counselor', 'stake_clerk'].includes(userRole)) return true;
      // HC and others need more than 50% approval
      const activeCount = hcMembers.filter(m => m.active).length;
      if (activeCount === 0) return true;
      return hcApprovals.filter(a => a.approved).length >= Math.ceil(activeCount / 2);
    }
    if (calling.stage === 'sustain' && calling.type === 'stake_calling') {
      // SP, counselors, clerk, exec secretary can advance before all wards sustained
      if (['stake_president', 'first_counselor', 'second_counselor', 'stake_clerk', 'exec_secretary'].includes(userRole)) return true;
      // HC members must wait for all wards to be sustained
      return allWards.every(w => wardSustainingsList.find(s => s.ward_id === w.id)?.sustained === true);
    }
    return true;
  }

  async function handleAdvance() {
    if (!calling || !profile) return;
    const next = getNextStage(calling.stage, calling.type);
    if (!next) return;

    if (!approvalsReady(profile.role)) {
      const msg = calling.stage === 'for_approval'
        ? t('detail.allThreeMustApprove')
        : calling.stage === 'sustain' && calling.type === 'stake_calling'
        ? t('detail.allWardsMustSustain')
        : t('detail.halfHCMustApprove');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('detail.approvalsNeeded'), msg);
      return;
    }

    setActionLoading(true);
    const label = getAdvanceLabel(calling.stage, calling.type);
    const update: any = { stage: next };
    if (next === 'complete') update.completed_at = new Date().toISOString();

    await supabase.from('callings').update(update).eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: label,
      from_stage: calling.stage, to_stage: next, performed_by: profile.id,
    });

    // Determine assignee for the next stage for Slack @mention
    const stageAssigneeMap: Partial<Record<string, string | null>> = {
      issue_calling: calling.extend_by,
      ordained: calling.extend_by,
      sustain: calling.sustain_by,
      set_apart: calling.set_apart_by,
      record: calling.record_by,
    };
    const assigneeName = stageAssigneeMap[next] ?? null;

    // Slack notification
    notifyStageChange({
      memberName: calling.member_name, callingName: calling.calling_name,
      wardName: calling.wards?.name, fromStage: STAGE_LABELS[calling.stage], toStage: STAGE_LABELS[next],
      toStageKey: next, performedBy: profile.full_name, callingId: calling.id, assigneeName,
    }).catch(() => {});

    await fetchData();
    setSuccessMsg(`${t('detail.movedTo')} ${STAGE_LABELS[next]}`);
    setTimeout(() => setSuccessMsg(''), 3000);
    setActionLoading(false);
  }

  async function handleMoveBack() {
    if (!calling || !profile) return;
    const prev = getPrevStage(calling.stage, calling.type);
    if (!prev) return;

    const confirm = Platform.OS === 'web'
      ? window.confirm(`${t('detail.moveBackConfirm')} "${STAGE_LABELS[prev]}"?`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('detail.moveBack'), `${t('detail.moveBackConfirm')} "${STAGE_LABELS[prev]}"?`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('detail.moveBack'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirm) return;

    setActionLoading(true);
    await supabase.from('callings').update({ stage: prev, completed_at: null }).eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: `${t('detail.movedBack')} ${STAGE_LABELS[prev]}`,
      from_stage: calling.stage, to_stage: prev, performed_by: profile.id,
    });
    await fetchData();
    setSuccessMsg(`${t('detail.movedBack')} ${STAGE_LABELS[prev]}`);
    setTimeout(() => setSuccessMsg(''), 3000);
    setActionLoading(false);
  }

  async function handleDelete() {
    if (!calling || !profile) return;
    const confirm = Platform.OS === 'web'
      ? window.confirm(`${t('detail.deleteConfirm')} ${calling.member_name}? ${t('detail.deleteCannotUndo')}`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('detail.deleteEntry'), `${t('detail.deleteConfirm')} ${calling.member_name}? ${t('detail.deleteCannotUndo')}`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('detail.delete'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirm) return;

    setActionLoading(true);
    await Promise.all([
      supabase.from('calling_log').delete().eq('calling_id', calling.id),
      supabase.from('stake_presidency_approvals').delete().eq('calling_id', calling.id),
      supabase.from('hc_approvals').delete().eq('calling_id', calling.id),
      supabase.from('ward_sustainings').delete().eq('calling_id', calling.id),
    ]);
    await supabase.from('callings').delete().eq('id', calling.id);
    navigation.goBack();
  }

  async function handleReject() {
    if (!calling || !profile) return;

    // If no notes, ask the user if they want to add some before proceeding
    if (!rejectionNotes.trim()) {
      const proceed = Platform.OS === 'web'
        ? window.confirm(t('detail.declineWithoutReason'))
        : await new Promise<boolean>(resolve =>
            Alert.alert(t('detail.noNotesAdded'), t('detail.declineWithoutReason'), [
              { text: t('detail.addNoteFirst'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('detail.declineAnyway'), style: 'destructive', onPress: () => resolve(true) },
            ])
          );
      if (!proceed) return;
    }

    setRejectLoading(true);
    await supabase.from('callings').update({ rejected: true, rejection_notes: rejectionNotes || null }).eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: 'Declined',
      from_stage: calling.stage, performed_by: profile.id, notes: rejectionNotes || null,
    });
    notifyRejection({
      memberName: calling.member_name, callingName: calling.calling_name,
      wardName: calling.wards?.name, notes: rejectionNotes,
      performedBy: profile.full_name, callingId: calling.id,
    }).catch(() => {});
    setShowRejectModal(false);
    setRejectionNotes('');
    await fetchData();
    setRejectLoading(false);
  }

  async function handleUnreject() {
    if (!calling || !profile) return;
    setActionLoading(true);
    await supabase.from('callings').update({ rejected: false, rejection_notes: null }).eq('id', calling.id);
    await supabase.from('calling_log').insert({ calling_id: calling.id, action: 'Rejection cleared', from_stage: calling.stage, performed_by: profile.id });
    await fetchData();
    setActionLoading(false);
  }

  if (loading) {
    return <View style={[styles.loading, { paddingTop: insets.top }]}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }
  if (!calling) {
    return <View style={[styles.loading, { paddingTop: insets.top }]}><Text style={styles.notFound}>{t('detail.notFound')}</Text><Button title={t('detail.goBack')} onPress={() => navigation.goBack()} variant="outline" /></View>;
  }

  const role = profile?.role;
  const canAdvance = role ? canAdvanceStage(role, calling.stage, calling.type) : false;
  const canRejectCalling = role ? canReject(role, calling.stage) : false;
  const canBack = role ? canMoveback(role) : false;
  const canDel = role ? canDelete(role) : false;
  const canAssign = !!(role && ['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary','high_councilor'].includes(role));

  // Build list of assignable people: SP members table + active HC members
  const spAssignees: Assignee[] = spMembers.map(m => ({ name: m.name, subtitle: SP_ROLE_LABELS[m.role] ?? m.role }));
  const hcAssignees: Assignee[] = hcMembers.map(m => ({ name: m.name, subtitle: t('role.high_councilor') }));
  const taskAssignees: Assignee[] = [...spAssignees, ...hcAssignees];

  const clerkName = allProfiles.find(p => p.role === 'stake_clerk')?.full_name ?? null;
  const advanceLabel = getAdvanceLabel(calling.stage, calling.type);
  const prevStage = getPrevStage(calling.stage, calling.type);
  const isComplete = calling.stage === 'complete';

  const showSustaining = calling.type === 'stake_calling' && ['sustain','set_apart','record','complete'].includes(calling.stage);
  const showSPApprovals = ['for_approval','stake_approved','hc_approval'].includes(calling.stage);
  const showHCApprovals = ['hc_approval','issue_calling','ordained','sustain','set_apart','record','complete'].includes(calling.stage);
  const spPresidentApproved = spApprovals.find(a => a.role === 'stake_president')?.approved ?? false;

  const canToggleSP = !!(role && ['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'].includes(role));
  const canToggleHC = !!(role && ['stake_president','high_councilor','stake_clerk','exec_secretary'].includes(role));
  const canSeeRejectionLog = !!(role && ['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'].includes(role));

  // Filter log entries: hide rejection entries from non-SP/clerk users
  const visibleLog = canSeeRejectionLog
    ? log
    : log.filter(e => !e.action.toLowerCase().includes('declin') && !e.action.toLowerCase().includes('reject'));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View style={styles.headerBadges}>
          <Image source={TYPE_ICONS[calling.type]} style={styles.typeIcon} />
          <Badge label={TYPE_LABELS[calling.type]} color={TYPE_COLORS[calling.type]} />
          <View style={{ width: Spacing.xs }} />
          <Badge label={STAGE_LABELS[calling.stage]} stage={calling.stage} />
        </View>
        {canDel && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteHeaderBtn} disabled={actionLoading}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={styles.memberName}>{calling.member_name}</Text>
          <Text style={styles.callingNameText}>{calling.calling_name}</Text>
        </View>

        {calling.rejected && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedRow}>
              <Ionicons name="close-circle" size={20} color={Colors.error} />
              <Text style={styles.rejectedTitle}>{t('detail.declined')}</Text>
            </View>
            {calling.rejection_notes ? <Text style={styles.rejectedNotes}>{calling.rejection_notes}</Text> : null}
            {(role === 'stake_president' || role === 'stake_clerk') && (
              <TouchableOpacity onPress={handleUnreject} style={styles.unrejectBtn}>
                <Text style={styles.unrejectBtnText}>{t('detail.clearDecline')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.successBannerText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('detail.ward')}</Text>
              <Text style={styles.infoValue}>{calling.wards?.name ?? 'TBD'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{TYPE_LABELS[calling.type]}</Text>
            </View>
            {calling.ordination_type && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('ordination.title')}</Text>
                <Text style={styles.infoValue}>{calling.ordination_type === 'elder' ? t('ordination.elder') : t('ordination.highPriest')}</Text>
              </View>
            )}
            {calling.bishop_approved && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Bishop</Text>
                <Text style={[styles.infoValue, { color: Colors.success }]}>Approved ✓</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('detail.createdBy')}</Text>
              <Text style={styles.infoValue}>{calling.profiles?.full_name ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>{formatDate(calling.created_at)}</Text>
            </View>
            {calling.completed_at && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Completed</Text>
                <Text style={styles.infoValue}>{formatDate(calling.completed_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Release Member */}
        <ReleaseMemberSection
          calling={calling}
          wards={allWards}
          canEdit={canAssign}
          onSave={async (name, currentCalling, wardId) => {
            await supabase.from('callings').update({
              release_member_name: name || null,
              release_current_calling: currentCalling || null,
              release_ward_id: wardId || null,
            }).eq('id', calling.id);
            setCalling(prev => prev ? { ...prev, release_member_name: name || null, release_current_calling: currentCalling || null, release_ward_id: wardId || null } : prev);
          }}
          onToggleDone={async () => {
            const newVal = !calling.release_done;
            await supabase.from('callings').update({ release_done: newVal }).eq('id', calling.id);
            setCalling(prev => prev ? { ...prev, release_done: newVal } : prev);
          }}
        />

        {/* Task Assignments */}
        {!isComplete && (
          <TaskAssignmentsSection
            calling={calling}
            assignees={taskAssignees}
            clerkName={clerkName}
            canEdit={canAssign}
            onAssign={handleAssign}
          />
        )}

        {/* SP Approvals */}
        {showSPApprovals && (
          <StakePresidencyApprovalSection
            callingId={callingId}
            approvals={spApprovals}
            canToggle={canToggleSP && !isComplete}
            userRole={role}
            onToggle={toggleSPApproval}
            showOverrideNote={calling.stage === 'hc_approval' && spPresidentApproved}
          />
        )}

        {/* HC Approvals */}
        {showHCApprovals && (
          <HCApprovalSection
            hcMembers={hcMembers}
            hcApprovals={hcApprovals}
            canToggle={canToggleHC && !isComplete}
            spOverride={spPresidentApproved}
            onToggle={toggleHCApproval}
          />
        )}

        {/* Ward Sustaining */}
        {showSustaining && allWards.length > 0 && (
          <WardSustainingSection
            wards={allWards}
            sustainings={wardSustainingsList}
            canToggle={!!(role && ['high_councilor','stake_clerk','exec_secretary','stake_president','first_counselor','second_counselor'].includes(role))}
            onToggle={handleWardSustainingToggle}
          />
        )}

        {/* Notes */}
        <NotesSection
          notes={calling.notes ?? ''}
          canEdit={canAssign}
          onSave={async (text) => {
            await supabase.from('callings').update({ notes: text || null }).eq('id', calling.id);
            setCalling(prev => prev ? { ...prev, notes: text || undefined } : prev);
          }}
        />

        {/* Actions */}
        {(!isComplete || (canBack && prevStage)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {canAdvance && !calling.rejected && (
              <Button title={advanceLabel} onPress={handleAdvance} loading={actionLoading} fullWidth size="lg" style={styles.advanceBtn} />
            )}
            {canRejectCalling && !calling.rejected && (
              <Button title={t('detail.decline')} onPress={() => setShowRejectModal(true)} variant="danger" fullWidth style={styles.rejectBtn} />
            )}
            {canBack && prevStage && !calling.rejected && (
              <Button
                title={`← ${t('detail.moveBack')} ${STAGE_LABELS[prevStage]}`}
                onPress={handleMoveBack}
                variant="outline"
                fullWidth
                style={styles.backStageBtn}
                disabled={actionLoading}
              />
            )}
            {!canAdvance && !canRejectCalling && !canBack && (
              <Text style={styles.noActionsText}>No actions available at this stage for your role.</Text>
            )}
          </View>
        )}

        {/* Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('detail.activityLog')}</Text>
          {visibleLog.length === 0 ? (
            <Text style={styles.emptyLog}>{t('detail.noActivity')}</Text>
          ) : (
            visibleLog.map((entry, index) => (
              <View key={entry.id} style={styles.logEntry}>
                <View style={styles.logDot} />
                {index < visibleLog.length - 1 && <View style={styles.logLine} />}
                <View style={styles.logContent}>
                  <View style={styles.logTopRow}>
                    <Text style={styles.logAction}>{entry.action}</Text>
                    <Text style={styles.logTime}>{formatDateTime(entry.created_at)}</Text>
                  </View>
                  {entry.profiles && <Text style={styles.logPerformer}>by {entry.profiles.full_name}</Text>}
                  {entry.from_stage && entry.to_stage && (
                    <Text style={styles.logStageChange}>{STAGE_LABELS[entry.from_stage as Stage]} → {STAGE_LABELS[entry.to_stage as Stage]}</Text>
                  )}
                  {entry.notes && <Text style={styles.logNotes}>{entry.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </View>
        <DisclaimerFooter />
      </ScrollView>

      {/* Decline Modal */}
      <Modal visible={showRejectModal} transparent animationType="slide" onRequestClose={() => setShowRejectModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRejectModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('detail.declineCalling')}</Text>
            <Text style={styles.modalSubtitle}>{t('detail.declineCallingDesc')}</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectionNotes}
              onChangeText={setRejectionNotes}
              placeholder={t('detail.declineReasonPlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              multiline numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Button title={t('detail.cancel')} onPress={() => { setShowRejectModal(false); setRejectionNotes(''); }} variant="outline" style={styles.modalBtn} />
              <Button title={t('detail.confirmDecline')} onPress={handleReject} variant="danger" loading={rejectLoading} style={styles.modalBtn} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  notFound: { fontSize: FontSize.lg, color: Colors.gray[500], marginBottom: Spacing.md },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  backBtn: { padding: Spacing.xs },
  headerBadges: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  typeIcon: { width: 28, height: 28, borderRadius: 6 },
  deleteHeaderBtn: { padding: Spacing.xs },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  heroSection: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any) },
  memberName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  callingNameText: { fontSize: FontSize.lg, color: Colors.gray[700], fontWeight: '500' },
  rejectedBanner: { backgroundColor: Colors.error + '10', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.error + '40' },
  rejectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rejectedTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.error, marginLeft: Spacing.xs },
  rejectedNotes: { fontSize: FontSize.sm, color: Colors.error, marginTop: 4 },
  unrejectBtn: { marginTop: Spacing.sm, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.error },
  unrejectBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success + '15', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success + '40', gap: Spacing.xs },
  successBannerText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },
  section: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.md },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  infoItem: { minWidth: '45%', flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  infoValue: { fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '500' },
  notesBox: { marginTop: Spacing.md, backgroundColor: Colors.gray[50], borderRadius: Radius.sm, padding: Spacing.sm },
  notesText: { fontSize: FontSize.md, color: Colors.gray[700], lineHeight: 22, marginTop: 4 },
  advanceBtn: { marginBottom: Spacing.sm },
  rejectBtn: { marginBottom: Spacing.sm },
  backStageBtn: { marginBottom: Spacing.sm },
  noActionsText: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic', textAlign: 'center', padding: Spacing.sm },
  emptyLog: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  logEntry: { flexDirection: 'row', marginBottom: Spacing.md, position: 'relative' },
  logDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 5, marginRight: Spacing.sm, flexShrink: 0 },
  logLine: { position: 'absolute', left: 4, top: 14, bottom: -Spacing.md, width: 2, backgroundColor: Colors.gray[200] },
  logContent: { flex: 1 },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 },
  logAction: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], flex: 1 },
  logTime: { fontSize: FontSize.xs, color: Colors.gray[400], flexShrink: 0 },
  logPerformer: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  logStageChange: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  logNotes: { fontSize: FontSize.sm, color: Colors.gray[600], marginTop: 4, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.gray[900], marginBottom: Spacing.xs },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginBottom: Spacing.md },
  modalInput: { backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.black, minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
  modalBtn: { flex: 1 },
});
