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

interface SPMember {
  id: string;
  name: string;
  role: 'stake_president' | 'first_counselor' | 'second_counselor';
  sort_order: number;
  active: boolean;
}

const ROLE_OPTIONS: { value: SPMember['role']; label: string }[] = [
  { value: 'stake_president', label: 'Stake President' },
  { value: 'first_counselor', label: '1st Counselor' },
  { value: 'second_counselor', label: '2nd Counselor' },
];

export function SPAdminScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<SPMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<SPMember['role']>('first_counselor');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

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
      else Alert.alert('Error', error.message);
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
      ? window.confirm(`Remove ${member.name}?`)
      : await new Promise<boolean>(resolve =>
          Alert.alert('Remove Member', `Remove ${member.name}?`, [
            { text: 'Cancel', onPress: () => resolve(false) },
            { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    await supabase.from('sp_members').delete().eq('id', member.id);
    setMembers(prev => prev.filter(m => m.id !== member.id));
  }

  const roleLabel = (role: SPMember['role']) => ROLE_OPTIONS.find(r => r.value === role)?.label ?? role;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Stake Presidency</Text>
          <Text style={styles.subtitle}>{members.filter(m => m.active).length} active members</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Add Member */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Member</Text>
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
              placeholder="Full name…"
              placeholderTextColor={Colors.gray[400]}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            <Button
              title="Add"
              onPress={handleAdd}
              loading={adding}
              disabled={!newName.trim() || adding}
              style={styles.addBtn}
            />
          </View>
        </View>

        {/* Member List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
          ) : members.length === 0 ? (
            <Text style={styles.empty}>No members added yet.</Text>
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
                </View>
                {!member.active && <Text style={styles.inactiveLabel}>inactive</Text>}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(member)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
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
  inactiveLabel: { fontSize: FontSize.xs, color: Colors.gray[400], fontStyle: 'italic' },
  deleteBtn: { padding: Spacing.xs },
});
