import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

interface SPMember {
  id: string;
  name: string;
  role: 'stake_president' | 'first_counselor' | 'second_counselor' | 'stake_clerk' | 'exec_secretary';
  sort_order: number;
  active: boolean;
  slack_user_id: string | null;
}

export function SPAdminScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const ROLE_OPTIONS: { value: SPMember['role']; label: string }[] = [
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
    const { data } = await supabase
      .from('sp_members')
      .select('*')
      .order('sort_order')
      .order('name');
    setMembers((data as SPMember[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('sp_members')
      .insert({ name, role: newRole, sort_order: maxOrder, active: true });
    if (error) {
      if (Platform.OS === 'web') window.alert(error.message);
      else Alert.alert(t('common.error'), error.message);
    } else {
      setNewName('');
      fetchMembers();
    }
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
    await supabase
      .from('sp_members')
      .update({ slack_user_id: value })
      .eq('id', slackModal.id);
    setMembers(prev => prev.map(m => m.id === slackModal.id ? { ...m, slack_user_id: value } : m));
    setSlackSaving(false);
    setSlackModal(null);
  }

  const roleLabel = (role: SPMember['role']) => ROLE_OPTIONS.find(r => r.value === role)?.label ?? role;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('spAdmin.title')}</Text>
          <Text style={styles.subtitle}>{members.filter(m => m.active).length} {t('spAdmin.activeMembers')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Add Member */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('spAdmin.addMember')}</Text>
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleChip, newRole === r.value && styles.roleChipActive]}
                onPress={() => setNewRole(r.value)}
              >
                <Text style={[styles.roleChipText, newRole === r.value && styles.roleChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('spAdmin.namePlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Button
              title={t('spAdmin.add')}
              onPress={handleAdd}
              loading={adding}
              disabled={!newName.trim() || adding}
              style={styles.addBtn}
            />
          </View>
        </View>

        {/* Member List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('spAdmin.members')}</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
          ) : members.length === 0 ? (
            <Text style={styles.empty}>{t('spAdmin.noMembers')}</Text>
          ) : (
            members.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <TouchableOpacity
                  style={[styles.activeToggle, member.active && styles.activeToggleOn]}
                  onPress={() => toggleActive(member)}
                  disabled={saving[member.id]}
                >
                  {saving[member.id] ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={[styles.activeToggleText, member.active && styles.activeToggleTextOn]}>
                      {member.active ? '✓' : '—'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, !member.active && styles.memberNameInactive]}>
                    {member.name}
                  </Text>
                  <Text style={styles.memberRole}>{roleLabel(member.role)}</Text>
                  {member.slack_user_id ? (
                    <Text style={styles.slackIdText}>@ {member.slack_user_id}</Text>
                  ) : null}
                </View>
                {!member.active && <Text style={styles.inactiveLabel}>{t('spAdmin.inactive')}</Text>}
                <TouchableOpacity
                  style={styles.slackBtn}
                  onPress={() => setSlackModal({ id: member.id, name: member.name, value: member.slack_user_id ?? '' })}
                  accessibilityLabel={t('common.setSlackId')}
                  accessibilityRole="button"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="at-outline"
                    size={18}
                    color={member.slack_user_id ? Colors.primary : Colors.gray[400]}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(member)}
                  accessibilityLabel={t('spAdmin.remove')}
                  accessibilityRole="button"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Slack User ID Modal */}
      <Modal visible={!!slackModal} transparent animationType="fade" onRequestClose={() => setSlackModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('spAdmin.slackId')}</Text>
            <Text style={styles.modalName}>{slackModal?.name}</Text>
            <TextInput
              style={styles.modalInput}
              value={slackModal?.value ?? ''}
              onChangeText={v => setSlackModal(prev => prev ? { ...prev, value: v } : null)}
              placeholder={t('spAdmin.slackIdPlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHint}>{t('spAdmin.slackIdHint')}</Text>
            <View style={styles.modalButtons}>
              <Button
                title={t('detail.cancel')}
                onPress={() => setSlackModal(null)}
                variant="secondary"
                style={styles.modalBtn}
              />
              <Button
                title={t('detail.save')}
                onPress={handleSaveSlackId}
                loading={slackSaving}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[500] },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  section: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.md },
  roleRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm, flexWrap: 'wrap' },
  roleChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  roleChipText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  roleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.gray[50], borderWidth: 1.5,
    borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.black,
  },
  addBtn: { flexShrink: 0 },
  empty: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic', textAlign: 'center', padding: Spacing.md },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  activeToggle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.gray[300],
    backgroundColor: Colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
  },
  activeToggleOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  activeToggleText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gray[500] },
  activeToggleTextOn: { color: Colors.white },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '500' },
  memberNameInactive: { color: Colors.gray[400] },
  memberRole: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  slackIdText: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },
  inactiveLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  slackBtn: { padding: Spacing.xs },
  deleteBtn: { padding: Spacing.xs },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, width: '100%', maxWidth: 400,
  },
  modalTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: 4 },
  modalName: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.md },
  modalInput: {
    backgroundColor: Colors.gray[50], borderWidth: 1.5,
    borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.black, marginBottom: Spacing.xs,
  },
  modalHint: { fontSize: FontSize.xs, color: Colors.gray[400], marginBottom: Spacing.md },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  modalBtn: { flex: 1 },
});
