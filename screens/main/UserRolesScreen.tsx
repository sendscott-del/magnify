import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/database.types';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';

const ALL_ROLES: UserRole[] = [
  'stake_president', 'first_counselor', 'second_counselor',
  'high_councilor', 'stake_clerk', 'exec_secretary',
];

export function UserRolesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'approved')
      .order('full_name');
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchUsers(); }, [fetchUsers]));

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(prev => ({ ...prev, [userId]: true }));
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) {
      const msg = error.message;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(t('common.error'), msg);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setSaving(prev => ({ ...prev, [userId]: false }));
    setEditingId(null);
  }

  async function handleRemoveUser(user: Profile) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${t('userRoles.removeConfirm')} ${user.full_name}?`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(
            t('userRoles.removeTitle'),
            `${t('userRoles.removeConfirm')} ${user.full_name}?`,
            [
              { text: t('detail.cancel'), onPress: () => resolve(false) },
              { text: t('userRoles.remove'), style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );
    if (!confirmed) return;
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', user.id);
    setUsers(prev => prev.filter(u => u.id !== user.id));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('userRoles.title')}</Text>
          <Text style={styles.subtitle}>{users.length} {t('userRoles.approvedCount')}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
          ) : users.length === 0 ? (
            <Text style={styles.empty}>{t('userRoles.noUsers')}</Text>
          ) : (
            users.map(user => {
              const isEditing = editingId === user.id;
              return (
                <View key={user.id} style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.full_name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    {!isEditing && (
                      <Text style={styles.userRole}>{ROLE_LABELS[user.role as UserRole]}</Text>
                    )}
                  </View>

                  {isEditing ? (
                    <View style={styles.editSection}>
                      <Text style={styles.editLabel}>{t('userRoles.assignRole')}</Text>
                      <View style={styles.roleChipRow}>
                        {ALL_ROLES.map(r => (
                          <TouchableOpacity
                            key={r}
                            style={[styles.roleChip, user.role === r && styles.roleChipActive]}
                            onPress={() => handleRoleChange(user.id, r)}
                            disabled={saving[user.id]}
                          >
                            {saving[user.id] && user.role !== r ? null : (
                              <Text style={[styles.roleChipText, user.role === r && styles.roleChipTextActive]}>
                                {ROLE_LABELS[r]}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveUser(user)}
                        >
                          <Ionicons name="person-remove-outline" size={16} color={Colors.error} />
                          <Text style={styles.removeBtnText}>{t('userRoles.revokeAccess')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => setEditingId(null)}
                        >
                          <Text style={styles.cancelBtnText}>{t('detail.cancel')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => setEditingId(user.id)}
                    >
                      <Ionicons name="create-outline" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
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
  empty: {
    fontSize: FontSize.sm, color: Colors.gray[400],
    fontStyle: 'italic', textAlign: 'center', padding: Spacing.md,
  },
  userRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  userInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  userName: { fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '600' },
  userEmail: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  userRole: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  editBtn: { position: 'absolute', right: 0, top: Spacing.sm, padding: Spacing.xs },
  editSection: { marginTop: Spacing.sm },
  editLabel: {
    fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], marginBottom: 4,
  },
  roleChipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: Spacing.sm,
  },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.gray[300], backgroundColor: Colors.white,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  roleChipText: { fontSize: FontSize.xs, color: Colors.gray[600] },
  roleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  editActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.error + '10',
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  removeBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  cancelBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  cancelBtnText: { fontSize: FontSize.sm, color: Colors.gray[500], fontWeight: '600' },
});
