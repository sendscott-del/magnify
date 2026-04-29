import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/database.types';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';

const ALL_ROLES: UserRole[] = [
  'stake_president', 'first_counselor', 'second_counselor',
  'high_councilor', 'stake_clerk', 'exec_secretary',
];

interface SPMember {
  id: string; name: string;
  role: 'stake_president' | 'first_counselor' | 'second_counselor' | 'stake_clerk' | 'exec_secretary';
  sort_order: number; active: boolean; slack_user_id: string | null;
}

interface HCMember {
  id: string; name: string; sort_order: number; active: boolean; slack_user_id: string | null;
}

type TabId = 'users' | 'sp' | 'hc';

export function UserRolesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('users');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('userRoles.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { id: 'users' as TabId, label: t('userRoles.usersTab') },
          { id: 'sp' as TabId, label: t('spAdmin.title') },
          { id: 'hc' as TabId, label: t('hcAdmin.title') },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'sp' && <SPTab />}
        {activeTab === 'hc' && <HCTab />}
      </ScrollView>
    </View>
  );
}

// ─── Users Tab ───

function UsersTab() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('status', 'approved').order('full_name');
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchUsers(); }, [fetchUsers]));

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(prev => ({ ...prev, [userId]: true }));
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setSaving(prev => ({ ...prev, [userId]: false }));
    setEditingId(null);
  }

  async function handleRemoveUser(user: Profile) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${t('userRoles.removeConfirm')} ${user.full_name}?`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('userRoles.removeTitle'), `${t('userRoles.removeConfirm')} ${user.full_name}?`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('userRoles.remove'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', user.id);
    setUsers(prev => prev.filter(u => u.id !== user.id));
  }

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionSubtitle}>{users.length} {t('userRoles.approvedCount')}</Text>
      {users.length === 0 ? (
        <Text style={styles.empty}>{t('userRoles.noUsers')}</Text>
      ) : (
        users.map(user => (
          <View key={user.id} style={styles.memberRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{user.full_name}</Text>
                <Text style={styles.memberSub}>{user.email}</Text>
                {editingId !== user.id && (
                  <Text style={styles.memberRole}>{ROLE_LABELS[user.role as UserRole]}</Text>
                )}
              </View>
              {editingId !== user.id && (
                <TouchableOpacity style={styles.editIcon} onPress={() => setEditingId(user.id)}>
                  <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {editingId === user.id && (
              <View style={{ width: '100%' }}>
                <View style={styles.roleChipRow}>
                  {ALL_ROLES.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, user.role === r && styles.roleChipActive]}
                      onPress={() => handleRoleChange(user.id, r)}
                      disabled={saving[user.id]}
                    >
                      <Text style={[styles.roleChipText, user.role === r && styles.roleChipTextActive]}>
                        {ROLE_LABELS[r]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveUser(user)}>
                    <Ionicons name="person-remove-outline" size={14} color={Colors.error} />
                    <Text style={styles.removeBtnText}>{t('userRoles.revokeAccess')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingId(null)}>
                    <Text style={styles.cancelText}>{t('detail.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ─── SP Members Tab ───

function SPTab() {
  const { t } = useLanguage();
  const SP_ROLES: { value: SPMember['role']; label: string }[] = [
    { value: 'stake_president', label: t('spAdmin.spShort') },
    { value: 'first_counselor', label: t('spAdmin.c1Short') },
    { value: 'second_counselor', label: t('spAdmin.c2Short') },
    { value: 'stake_clerk', label: t('role.stake_clerk') },
    { value: 'exec_secretary', label: t('role.exec_secretary') },
  ];

  const [members, setMembers] = useState<SPMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<SPMember['role']>('first_counselor');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [slackModal, setSlackModal] = useState<{ id: string; name: string; value: string } | null>(null);
  const [slackSaving, setSlackSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('sp_members').select('*').order('sort_order').order('name');
    setMembers((data as SPMember[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase.from('sp_members').insert({ name, role: newRole, sort_order: maxOrder, active: true });
    if (error) {
      if (Platform.OS === 'web') window.alert(error.message);
      else Alert.alert(t('common.error'), error.message);
    } else { setNewName(''); fetchMembers(); }
    setAdding(false);
  }

  async function toggleActive(member: SPMember) {
    setSaving(prev => ({ ...prev, [member.id]: true }));
    await supabase.from('sp_members').update({ active: !member.active }).eq('id', member.id);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, active: !m.active } : m));
    setSaving(prev => ({ ...prev, [member.id]: false }));
  }

  async function handleDelete(member: SPMember) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${member.name} — ${t('spAdmin.removeConfirm')}`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('spAdmin.removeTitle'), `${member.name} — ${t('spAdmin.removeConfirm')}`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('spAdmin.remove'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    await supabase.from('sp_members').delete().eq('id', member.id);
    setMembers(prev => prev.filter(m => m.id !== member.id));
  }

  async function handleSaveSlackId() {
    if (!slackModal) return;
    setSlackSaving(true);
    const value = slackModal.value.trim() || null;
    await supabase.from('sp_members').update({ slack_user_id: value }).eq('id', slackModal.id);
    setMembers(prev => prev.map(m => m.id === slackModal.id ? { ...m, slack_user_id: value } : m));
    setSlackSaving(false);
    setSlackModal(null);
  }

  const roleLabel = (role: SPMember['role']) => SP_ROLES.find(r => r.value === role)?.label ?? role;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionSubtitle}>{members.filter(m => m.active).length} {t('spAdmin.activeMembers')}</Text>

        {/* Add member */}
        <View style={styles.roleChipRow}>
          {SP_ROLES.map(r => (
            <TouchableOpacity key={r.value} style={[styles.roleChip, newRole === r.value && styles.roleChipActive]} onPress={() => setNewRole(r.value)}>
              <Text style={[styles.roleChipText, newRole === r.value && styles.roleChipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder={t('spAdmin.namePlaceholder')} placeholderTextColor={Colors.gray[400]} onSubmitEditing={handleAdd} returnKeyType="done" />
          <Button title={t('spAdmin.add')} onPress={handleAdd} loading={adding} disabled={!newName.trim() || adding} style={styles.addBtn} />
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} /> : members.length === 0 ? (
          <Text style={styles.empty}>{t('spAdmin.noMembers')}</Text>
        ) : members.map(member => (
          <View key={member.id} style={styles.memberRow}>
            <TouchableOpacity
              style={[styles.activeToggle, member.active && styles.activeToggleOn]}
              onPress={() => toggleActive(member)} disabled={saving[member.id]}
            >
              {saving[member.id] ? <ActivityIndicator size="small" color={Colors.white} /> : (
                <Text style={[styles.activeToggleText, member.active && styles.activeToggleTextOn]}>{member.active ? '✓' : '—'}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, !member.active && styles.memberNameInactive]}>{member.name}</Text>
              <Text style={styles.memberSub}>{roleLabel(member.role)}</Text>
              {member.slack_user_id && <Text style={styles.slackIdText}>@ {member.slack_user_id}</Text>}
            </View>
            {!member.active && <Text style={styles.inactiveLabel}>{t('spAdmin.inactive')}</Text>}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setSlackModal({ id: member.id, name: member.name, value: member.slack_user_id ?? '' })}
              accessibilityLabel={t('common.setSlackId')}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="at-outline" size={18} color={member.slack_user_id ? Colors.primary : Colors.gray[400]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleDelete(member)}
              accessibilityLabel={t('detail.delete')}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Slack ID Modal */}
      <Modal visible={!!slackModal} transparent animationType="fade" onRequestClose={() => setSlackModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('spAdmin.slackId')}</Text>
            <Text style={styles.modalName}>{slackModal?.name}</Text>
            <TextInput style={styles.modalInput} value={slackModal?.value ?? ''} onChangeText={v => setSlackModal(prev => prev ? { ...prev, value: v } : null)} placeholder={t('spAdmin.slackIdPlaceholder')} placeholderTextColor={Colors.gray[400]} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.modalHint}>{t('spAdmin.slackIdHint')}</Text>
            <View style={styles.modalButtons}>
              <Button title={t('detail.cancel')} onPress={() => setSlackModal(null)} variant="secondary" style={styles.modalBtn} />
              <Button title={t('detail.save')} onPress={handleSaveSlackId} loading={slackSaving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── HC Members Tab ───

function HCTab() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<HCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [slackModal, setSlackModal] = useState<{ id: string; name: string; value: string } | null>(null);
  const [slackSaving, setSlackSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('high_council_members').select('*').order('sort_order').order('name');
    setMembers((data as HCMember[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase.from('high_council_members').insert({ name, sort_order: maxOrder, active: true });
    if (error) {
      if (Platform.OS === 'web') window.alert(error.message);
      else Alert.alert(t('common.error'), error.message);
    } else { setNewName(''); fetchMembers(); }
    setAdding(false);
  }

  async function toggleActive(member: HCMember) {
    setSaving(prev => ({ ...prev, [member.id]: true }));
    await supabase.from('high_council_members').update({ active: !member.active }).eq('id', member.id);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, active: !m.active } : m));
    setSaving(prev => ({ ...prev, [member.id]: false }));
  }

  async function handleDelete(member: HCMember) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${member.name} — ${t('hcAdmin.removeConfirm')}`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('hcAdmin.removeTitle'), `${member.name} — ${t('hcAdmin.removeConfirm')}`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('hcAdmin.remove'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    await supabase.from('high_council_members').delete().eq('id', member.id);
    setMembers(prev => prev.filter(m => m.id !== member.id));
  }

  async function handleSaveSlackId() {
    if (!slackModal) return;
    setSlackSaving(true);
    const value = slackModal.value.trim() || null;
    await supabase.from('high_council_members').update({ slack_user_id: value }).eq('id', slackModal.id);
    setMembers(prev => prev.map(m => m.id === slackModal.id ? { ...m, slack_user_id: value } : m));
    setSlackSaving(false);
    setSlackModal(null);
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionSubtitle}>{members.filter(m => m.active).length} {t('hcAdmin.activeMembers')}</Text>
        <Text style={styles.hint}>{t('hcAdmin.hint')}</Text>

        <View style={styles.addRow}>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder={t('hcAdmin.namePlaceholder')} placeholderTextColor={Colors.gray[400]} onSubmitEditing={handleAdd} returnKeyType="done" />
          <Button title={t('hcAdmin.add')} onPress={handleAdd} loading={adding} disabled={!newName.trim() || adding} style={styles.addBtn} />
        </View>

        {loading ? <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} /> : members.length === 0 ? (
          <Text style={styles.empty}>{t('hcAdmin.noMembers')}</Text>
        ) : members.map(member => (
          <View key={member.id} style={styles.memberRow}>
            <TouchableOpacity
              style={[styles.activeToggle, member.active && styles.activeToggleOn]}
              onPress={() => toggleActive(member)} disabled={saving[member.id]}
            >
              {saving[member.id] ? <ActivityIndicator size="small" color={Colors.white} /> : (
                <Text style={[styles.activeToggleText, member.active && styles.activeToggleTextOn]}>{member.active ? '✓' : '—'}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, !member.active && styles.memberNameInactive]}>{member.name}</Text>
              {member.slack_user_id && <Text style={styles.slackIdText}>@ {member.slack_user_id}</Text>}
            </View>
            {!member.active && <Text style={styles.inactiveLabel}>{t('hcAdmin.inactive')}</Text>}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setSlackModal({ id: member.id, name: member.name, value: member.slack_user_id ?? '' })}
              accessibilityLabel={t('common.setSlackId')}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="at-outline" size={18} color={member.slack_user_id ? Colors.primary : Colors.gray[400]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleDelete(member)}
              accessibilityLabel={t('detail.delete')}
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Modal visible={!!slackModal} transparent animationType="fade" onRequestClose={() => setSlackModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('hcAdmin.slackId')}</Text>
            <Text style={styles.modalName}>{slackModal?.name}</Text>
            <TextInput style={styles.modalInput} value={slackModal?.value ?? ''} onChangeText={v => setSlackModal(prev => prev ? { ...prev, value: v } : null)} placeholder={t('hcAdmin.slackIdPlaceholder')} placeholderTextColor={Colors.gray[400]} autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.modalHint}>{t('hcAdmin.slackIdHint')}</Text>
            <View style={styles.modalButtons}>
              <Button title={t('detail.cancel')} onPress={() => setSlackModal(null)} variant="secondary" style={styles.modalBtn} />
              <Button title={t('detail.save')} onPress={handleSaveSlackId} loading={slackSaving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[400] },
  tabTextActive: { color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  section: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  sectionSubtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginBottom: Spacing.md },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 18 },
  empty: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic', textAlign: 'center', padding: Spacing.md },
  memberRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100], gap: Spacing.xs,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '600' },
  memberNameInactive: { color: Colors.gray[400] },
  memberSub: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  memberRole: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  slackIdText: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },
  inactiveLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  editIcon: { padding: Spacing.xs },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: Spacing.sm },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.gray[300], backgroundColor: Colors.white,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  roleChipText: { fontSize: FontSize.xs, color: Colors.gray[600] },
  roleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  editActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.error + '10', borderWidth: 1, borderColor: Colors.error + '30',
  },
  removeBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  cancelText: { fontSize: FontSize.sm, color: Colors.gray[500], fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.md },
  input: {
    flex: 1, backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200],
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.black,
  },
  addBtn: { flexShrink: 0 },
  activeToggle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.gray[300],
    backgroundColor: Colors.gray[100], alignItems: 'center', justifyContent: 'center',
  },
  activeToggleOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  activeToggleText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gray[500] },
  activeToggleTextOn: { color: Colors.white },
  iconBtn: { padding: Spacing.xs },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: 4 },
  modalName: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.md },
  modalInput: {
    backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.black, marginBottom: Spacing.xs,
  },
  modalHint: { fontSize: FontSize.xs, color: Colors.gray[400], marginBottom: Spacing.md },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  modalBtn: { flex: 1 },
});
