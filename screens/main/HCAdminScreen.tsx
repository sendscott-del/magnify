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

interface HCMember {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  slack_user_id: string | null;
}

export function HCAdminScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
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
    const { data } = await supabase
      .from('high_council_members')
      .select('*')
      .order('sort_order')
      .order('name');
    setMembers((data as HCMember[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('high_council_members')
      .insert({ name, sort_order: maxOrder, active: true });
    if (error) {
      const msg = error.message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('common.error'), msg);
    } else {
      setNewName('');
      fetchMembers();
    }
    setAdding(false);
  }

  async function toggleActive(member: HCMember) {
    setSaving(prev => ({ ...prev, [member.id]: true }));
    await supabase
      .from('high_council_members')
      .update({ active: !member.active })
      .eq('id', member.id);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, active: !m.active } : m));
    setSaving(prev => ({ ...prev, [member.id]: false }));
  }

  async function handleDelete(member: HCMember) {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`${member.name} — ${t('hcAdmin.removeConfirm')}`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('hcAdmin.removeTitle'), `${member.name} — ${t('hcAdmin.removeConfirm')}`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('hcAdmin.remove'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirm) return;
    await supabase.from('high_council_members').delete().eq('id', member.id);
    setMembers(prev => prev.filter(m => m.id !== member.id));
  }

  async function handleSaveSlackId() {
    if (!slackModal) return;
    setSlackSaving(true);
    const value = slackModal.value.trim() || null;
    await supabase
      .from('high_council_members')
      .update({ slack_user_id: value })
      .eq('id', slackModal.id);
    setMembers(prev => prev.map(m => m.id === slackModal.id ? { ...m, slack_user_id: value } : m));
    setSlackSaving(false);
    setSlackModal(null);
  }

  const activeCount = members.filter(m => m.active).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('hcAdmin.title')}</Text>
          <Text style={styles.subtitle}>{activeCount} {t('hcAdmin.activeMembers')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Add Member */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hcAdmin.addMember')}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('hcAdmin.namePlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Button
              title={t('hcAdmin.add')}
              onPress={handleAdd}
              loading={adding}
              disabled={!newName.trim() || adding}
              style={styles.addBtn}
            />
          </View>
        </View>

        {/* Member List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('hcAdmin.members')}</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
          ) : members.length === 0 ? (
            <Text style={styles.empty}>{t('hcAdmin.noMembers')}</Text>
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
                  {member.slack_user_id ? (
                    <Text style={styles.slackIdText}>@ {member.slack_user_id}</Text>
                  ) : null}
                </View>
                {!member.active && (
                  <Text style={styles.inactiveLabel}>{t('hcAdmin.inactive')}</Text>
                )}
                <TouchableOpacity
                  style={styles.slackBtn}
                  onPress={() => setSlackModal({ id: member.id, name: member.name, value: member.slack_user_id ?? '' })}
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
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <Text style={styles.hint}>{t('hcAdmin.hint')}</Text>
      </ScrollView>

      {/* Slack User ID Modal */}
      <Modal visible={!!slackModal} transparent animationType="fade" onRequestClose={() => setSlackModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('hcAdmin.slackId')}</Text>
            <Text style={styles.modalName}>{slackModal?.name}</Text>
            <TextInput
              style={styles.modalInput}
              value={slackModal?.value ?? ''}
              onChangeText={v => setSlackModal(prev => prev ? { ...prev, value: v } : null)}
              placeholder={t('hcAdmin.slackIdPlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.modalHint}>{t('hcAdmin.slackIdHint')}</Text>
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
  slackIdText: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 1 },
  inactiveLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  slackBtn: { padding: Spacing.xs },
  deleteBtn: { padding: Spacing.xs },
  hint: {
    fontSize: FontSize.xs, color: Colors.gray[400],
    textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg,
  },
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
