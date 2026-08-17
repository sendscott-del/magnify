import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { KeyboardAwareScrollView } from '../../components/ui/KeyboardAwareScrollView';
import { useLanguage } from '../../context/LanguageContext';
import { Ward } from '../../lib/database.types';

interface HCMember { id: string; name: string; active: boolean; sort_order: number; user_id: string | null; }
interface Account { id: string; full_name: string; email: string; }

export function HighCouncilScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [members, setMembers] = useState<HCMember[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [memberWards, setMemberWards] = useState<Record<string, Set<string>>>({});
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [linkModalFor, setLinkModalFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const fetchAll = useCallback(async () => {
    const [mRes, wRes, mwRes, aRes] = await Promise.all([
      supabase.from('high_council_members').select('id, name, active, sort_order, user_id').order('sort_order'),
      supabase.from('wards').select('*').order('name'),
      supabase.from('hc_member_wards').select('hc_member_id, ward_id'),
      supabase.from('profiles').select('id, full_name, email').eq('app', 'magnify').eq('status', 'approved').order('full_name'),
    ]);
    setMembers((mRes.data as HCMember[]) ?? []);
    setWards((wRes.data as Ward[]) ?? []);
    setAccounts((aRes.data as Account[]) ?? []);
    const map: Record<string, Set<string>> = {};
    ((mwRes.data as { hc_member_id: string; ward_id: string }[]) ?? []).forEach(r => {
      (map[r.hc_member_id] ??= new Set<string>()).add(r.ward_id);
    });
    setMemberWards(map);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  function showError(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert(t('common.error'), msg);
  }

  function confirmRemove(name: string, onYes: () => void) {
    const title = `${t('highCouncil.removeTitle')} ${name}?`;
    const message = t('highCouncil.removeConfirm');
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onYes();
    } else {
      Alert.alert(title, message, [
        { text: t('detail.cancel'), style: 'cancel' },
        { text: t('highCouncil.remove'), style: 'destructive', onPress: onYes },
      ]);
    }
  }

  async function addMember() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const sort_order = members.length ? Math.max(...members.map(m => m.sort_order ?? 0)) + 1 : 0;
    const { error } = await supabase.from('high_council_members').insert({ name, active: true, sort_order });
    if (error) showError(error.message);
    else setNewName('');
    await fetchAll();
    setAdding(false);
  }

  async function toggleActive(m: HCMember) {
    setBusy(p => ({ ...p, [m.id]: true }));
    const { error } = await supabase.from('high_council_members').update({ active: !m.active }).eq('id', m.id);
    if (error) showError(error.message);
    await fetchAll();
    setBusy(p => ({ ...p, [m.id]: false }));
  }

  function removeMember(m: HCMember) {
    confirmRemove(m.name, async () => {
      setBusy(p => ({ ...p, [m.id]: true }));
      const { error } = await supabase.from('high_council_members').delete().eq('id', m.id);
      if (error) showError(error.message);
      await fetchAll();
      setBusy(p => ({ ...p, [m.id]: false }));
    });
  }

  async function toggleWard(memberId: string, wardId: string) {
    const key = `${memberId}:${wardId}`;
    setBusy(p => ({ ...p, [key]: true }));
    const assigned = memberWards[memberId]?.has(wardId);
    const { error } = assigned
      ? await supabase.from('hc_member_wards').delete().eq('hc_member_id', memberId).eq('ward_id', wardId)
      : await supabase.from('hc_member_wards').insert({ hc_member_id: memberId, ward_id: wardId });
    if (error) showError(error.message);
    await fetchAll();
    setBusy(p => ({ ...p, [key]: false }));
  }

  async function linkAccount(memberId: string, userId: string) {
    setBusy(p => ({ ...p, [memberId]: true }));
    const { error } = await supabase.from('high_council_members').update({ user_id: userId }).eq('id', memberId);
    if (error) showError(error.message);
    setLinkModalFor(null);
    await fetchAll();
    setBusy(p => ({ ...p, [memberId]: false }));
  }

  async function unlinkAccount(memberId: string) {
    setBusy(p => ({ ...p, [memberId]: true }));
    const { error } = await supabase.from('high_council_members').update({ user_id: null }).eq('id', memberId);
    if (error) showError(error.message);
    await fetchAll();
    setBusy(p => ({ ...p, [memberId]: false }));
  }

  function startRename(m: HCMember) {
    setEditingId(m.id);
    setNameDraft(m.name);
  }

  async function saveRename(memberId: string) {
    const name = nameDraft.trim();
    if (!name) { setEditingId(null); return; }
    setBusy(p => ({ ...p, [memberId]: true }));
    const { error } = await supabase.from('high_council_members').update({ name }).eq('id', memberId);
    if (error) showError(error.message);
    setEditingId(null);
    await fetchAll();
    setBusy(p => ({ ...p, [memberId]: false }));
  }

  const accountById = React.useMemo(() => {
    const map: Record<string, Account> = {};
    accounts.forEach(a => { map[a.id] = a; });
    return map;
  }, [accounts]);

  // user_ids already linked to a roster member (so the picker can flag them)
  const linkedUserIds = React.useMemo(() => {
    const map: Record<string, string> = {}; // user_id -> member name
    members.forEach(m => { if (m.user_id) map[m.user_id] = m.name; });
    return map;
  }, [members]);

  const activeCount = members.filter(m => m.active).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('highCouncil.title')}</Text>
          <Text style={styles.subtitle}>
            {activeCount} {t('highCouncil.activeSuffix')}
          </Text>
        </View>
      </View>

      <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>{t('highCouncil.hint')}</Text>

        {/* Add member */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('highCouncil.addLabel')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('highCouncil.namePlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              autoCapitalize="words"
              onSubmitEditing={addMember}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, (adding || !newName.trim()) && styles.btnDisabled]}
              onPress={addMember}
              disabled={adding || !newName.trim()}
            >
              <Text style={styles.addBtnText}>{adding ? '…' : t('highCouncil.add')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Roster */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
        ) : members.length === 0 ? (
          <Text style={styles.empty}>{t('highCouncil.empty')}</Text>
        ) : (
          members.map(m => {
            const assigned = memberWards[m.id] ?? new Set<string>();
            const memberBusy = !!busy[m.id];
            const linkedAccount = m.user_id ? accountById[m.user_id] : null;
            const isEditing = editingId === m.id;
            return (
              <View key={m.id} style={[styles.memberCard, !m.active && styles.memberInactive]}>
                <View style={styles.memberTop}>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: Spacing.sm }]}
                      value={nameDraft}
                      onChangeText={setNameDraft}
                      autoFocus
                      autoCapitalize="words"
                      onSubmitEditing={() => saveRename(m.id)}
                      returnKeyType="done"
                    />
                  ) : (
                    <Text style={[styles.memberName, !m.active && styles.memberNameInactive]} numberOfLines={1}>
                      {m.name}
                    </Text>
                  )}
                  <View style={styles.memberActions}>
                    {isEditing ? (
                      <>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => saveRename(m.id)} disabled={memberBusy}>
                          <Ionicons name="checkmark" size={20} color={Colors.success} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingId(null)}>
                          <Ionicons name="close" size={20} color={Colors.gray[500]} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => startRename(m)} disabled={memberBusy}>
                          <Ionicons name="pencil-outline" size={16} color={Colors.gray[500]} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.statusPill, m.active ? styles.statusActive : styles.statusInactive, memberBusy && styles.btnDisabled]}
                          onPress={() => toggleActive(m)}
                          disabled={memberBusy}
                        >
                          <Text style={[styles.statusPillText, m.active ? styles.statusActiveText : styles.statusInactiveText]}>
                            {m.active ? t('highCouncil.active') : t('highCouncil.inactive')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.trashBtn, memberBusy && styles.btnDisabled]}
                          onPress={() => removeMember(m)}
                          disabled={memberBusy}
                        >
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                {/* Account link */}
                {linkedAccount ? (
                  <View style={styles.linkRow}>
                    <Ionicons name="link" size={14} color={Colors.success} />
                    <Text style={styles.linkEmail} numberOfLines={1}>{linkedAccount.email}</Text>
                    <TouchableOpacity onPress={() => unlinkAccount(m.id)} disabled={memberBusy}>
                      <Text style={styles.unlinkText}>{t('highCouncil.unlink')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : m.user_id ? (
                  <View style={styles.linkRow}>
                    <Ionicons name="link" size={14} color={Colors.gray[400]} />
                    <Text style={styles.linkEmailMuted} numberOfLines={1}>{t('highCouncil.linkedUnknown')}</Text>
                    <TouchableOpacity onPress={() => unlinkAccount(m.id)} disabled={memberBusy}>
                      <Text style={styles.unlinkText}>{t('highCouncil.unlink')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.linkBtn} onPress={() => setLinkModalFor(m.id)} disabled={memberBusy}>
                    <Ionicons name="link-outline" size={14} color={Colors.primary} />
                    <Text style={styles.linkBtnText}>{t('highCouncil.linkAccount')}</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.wardsLabel}>{t('highCouncil.wardsLabel')}</Text>
                <View style={styles.chipWrap}>
                  {wards.map(w => {
                    const on = assigned.has(w.id);
                    const chipKey = `${m.id}:${w.id}`;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.chip, on && styles.chipOn, busy[chipKey] && styles.btnDisabled]}
                        onPress={() => toggleWard(m.id, w.id)}
                        disabled={!!busy[chipKey]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{w.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </KeyboardAwareScrollView>

      {/* Link-to-account picker */}
      <Modal visible={linkModalFor !== null} transparent animationType="slide" onRequestClose={() => setLinkModalFor(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLinkModalFor(null)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('highCouncil.linkTitle')}</Text>
            <Text style={styles.modalHint}>{t('highCouncil.linkModalHint')}</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {accounts.length === 0 ? (
                <Text style={styles.empty}>{t('highCouncil.noAccounts')}</Text>
              ) : accounts.map(a => {
                const takenBy = linkedUserIds[a.id];
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.modalItem, !!takenBy && styles.btnDisabled]}
                    disabled={!!takenBy}
                    onPress={() => linkModalFor && linkAccount(linkModalFor, a.id)}
                  >
                    <Text style={styles.modalItemText}>{a.full_name || a.email}</Text>
                    <Text style={styles.modalItemSub} numberOfLines={1}>
                      {a.email}{takenBy ? ` · ${t('highCouncil.alreadyLinked')} ${takenBy}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 18 },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], marginBottom: Spacing.md, ...(Shadow as any),
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.gray[50], borderWidth: 1.5,
    borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: FontSize.sm, color: Colors.black,
  },
  addBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.sm, backgroundColor: Colors.primary,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.gray[400], fontSize: FontSize.sm, marginTop: Spacing.xl },
  memberCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], marginBottom: Spacing.sm, ...(Shadow as any),
  },
  memberInactive: { opacity: 0.6 },
  memberTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  memberName: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  memberNameInactive: { textDecorationLine: 'line-through' },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1 },
  statusActive: { backgroundColor: '#ecfdf5', borderColor: Colors.success },
  statusInactive: { backgroundColor: Colors.gray[100], borderColor: Colors.gray[300] },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  statusActiveText: { color: Colors.success },
  statusInactiveText: { color: Colors.gray[500] },
  trashBtn: { padding: Spacing.xs },
  iconBtn: { padding: Spacing.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  linkEmail: { flex: 1, fontSize: FontSize.xs, color: Colors.gray[600], fontWeight: '600' },
  linkEmailMuted: { flex: 1, fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  unlinkText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: Spacing.sm },
  linkBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, paddingBottom: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.xs },
  modalHint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 18 },
  modalItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  modalItemText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[800] },
  modalItemSub: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  wardsLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], marginBottom: Spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.gray[200], backgroundColor: Colors.gray[50],
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.gray[600], fontWeight: '600' },
  chipTextOn: { color: Colors.white },
  btnDisabled: { opacity: 0.5 },
});
