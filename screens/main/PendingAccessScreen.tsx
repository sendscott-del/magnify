import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/database.types';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';
import { notifyAccessApproved } from '../../lib/slack';

export function PendingAccessScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchPendingUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('status', 'pending').order('created_at');
    const users = (data as Profile[]) ?? [];
    setPendingUsers(users);
    const roleDefaults: Record<string, UserRole> = {};
    users.forEach(u => { roleDefaults[u.id] = (u.role as UserRole) || 'stake_clerk'; });
    setPendingRoles(prev => ({ ...roleDefaults, ...prev }));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchPendingUsers(); }, [fetchPendingUsers]));

  async function handleApprove(userId: string) {
    setApproving(prev => ({ ...prev, [userId]: true }));
    const user = pendingUsers.find(u => u.id === userId);
    const assignedRole = pendingRoles[userId] ?? 'stake_clerk';
    await supabase.from('profiles').update({ status: 'approved', role: assignedRole }).eq('id', userId);
    if (user) {
      notifyAccessApproved({ name: user.full_name, email: user.email, role: ROLE_LABELS[assignedRole] }).catch(() => {});
    }
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    setApproving(prev => ({ ...prev, [userId]: false }));
  }

  async function handleReject(userId: string) {
    setRejecting(prev => ({ ...prev, [userId]: true }));
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    setRejecting(prev => ({ ...prev, [userId]: false }));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('pendingAccess.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
        ) : pendingUsers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('settings.noPending')}</Text>
          </View>
        ) : (
          pendingUsers.map(u => (
            <View key={u.id} style={styles.userCard}>
              <Text style={styles.userName}>{u.full_name}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
              <Text style={styles.userRoleLabel}>{t('settings.assignRole')}</Text>
              <View style={styles.roleChipRow}>
                {(['stake_president', 'first_counselor', 'second_counselor', 'high_councilor', 'stake_clerk', 'exec_secretary'] as UserRole[]).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, pendingRoles[u.id] === r && styles.roleChipActive]}
                    onPress={() => setPendingRoles(prev => ({ ...prev, [u.id]: r }))}
                  >
                    <Text style={[styles.roleChipText, pendingRoles[u.id] === r && styles.roleChipTextActive]}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.approveBtn, approving[u.id] && styles.btnDisabled]}
                  onPress={() => handleApprove(u.id)}
                  disabled={approving[u.id]}
                >
                  <Text style={styles.approveBtnText}>
                    {approving[u.id] ? '…' : t('settings.approve')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, rejecting[u.id] && styles.btnDisabled]}
                  onPress={() => handleReject(u.id)}
                  disabled={rejecting[u.id]}
                >
                  <Text style={styles.rejectBtnText}>
                    {rejecting[u.id] ? '…' : t('settings.reject')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  empty: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.gray[200], alignItems: 'center', ...(Shadow as any),
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  userCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  userName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  userEmail: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 1 },
  userRoleLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], marginTop: Spacing.sm, marginBottom: 4 },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: Spacing.sm },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.gray[300], backgroundColor: Colors.white,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  roleChipText: { fontSize: FontSize.xs, color: Colors.gray[600] },
  roleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  userActions: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'flex-end', marginTop: Spacing.xs },
  approveBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.success,
  },
  approveBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  rejectBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.error + '15',
    borderWidth: 1, borderColor: Colors.error,
  },
  rejectBtnText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
