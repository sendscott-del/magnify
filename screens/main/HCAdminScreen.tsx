import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert, ActivityIndicator,
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
}

export function HCAdminScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [members, setMembers] = useState<HCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
      else Alert.alert('Error', msg);
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
                <Text style={[styles.memberName, !member.active && styles.memberNameInactive]}>
                  {member.name}
                </Text>
                {!member.active && (
                  <Text style={styles.inactiveLabel}>{t('hcAdmin.inactive')}</Text>
                )}
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
  memberName: { flex: 1, fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '500' },
  memberNameInactive: { color: Colors.gray[400] },
  inactiveLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  deleteBtn: { padding: Spacing.xs },
  hint: {
    fontSize: FontSize.xs, color: Colors.gray[400],
    textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg,
  },
});
