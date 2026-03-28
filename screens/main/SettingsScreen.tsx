import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile, UserRole } from '../../lib/database.types';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, isAdmin } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});

  const fetchPendingUsers = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending')
      .order('created_at');
    setPendingUsers((data as Profile[]) ?? []);
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      fetchPendingUsers();
    }, [fetchPendingUsers])
  );

  async function handleApprove(userId: string) {
    setApproving(prev => ({ ...prev, [userId]: true }));
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    setApproving(prev => ({ ...prev, [userId]: false }));
  }

  async function handleReject(userId: string) {
    setRejecting(prev => ({ ...prev, [userId]: true }));
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId);
    setPendingUsers(prev => prev.filter(u => u.id !== userId));
    setRejecting(prev => ({ ...prev, [userId]: false }));
  }

  function handleSignOut() {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of Magnify?')) {
        signOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]);
    }
  }

  function handleReload() {
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Profile</Text>
          {profile && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{profile.full_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{ROLE_LABELS[profile.role as UserRole]}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <View style={[styles.statusChip, profile.status === 'approved' ? styles.statusApproved : styles.statusPending]}>
                  <Text style={[styles.statusText, profile.status === 'approved' ? styles.statusTextApproved : styles.statusTextPending]}>
                    {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Admin: Manage Users */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manage Users</Text>
            {pendingUsers.length === 0 ? (
              <View style={styles.emptyUsers}>
                <Text style={styles.emptyUsersText}>No pending users</Text>
              </View>
            ) : (
              pendingUsers.map(u => (
                <View key={u.id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{u.full_name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <Text style={styles.userRole}>{ROLE_LABELS[u.role as UserRole]}</Text>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.approveBtn, approving[u.id] && styles.btnDisabled]}
                      onPress={() => handleApprove(u.id)}
                      disabled={approving[u.id]}
                    >
                      <Text style={styles.approveBtnText}>
                        {approving[u.id] ? '…' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectBtn, rejecting[u.id] && styles.btnDisabled]}
                      onPress={() => handleReject(u.id)}
                      disabled={rejecting[u.id]}
                    >
                      <Text style={styles.rejectBtnText}>
                        {rejecting[u.id] ? '…' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* App Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          {Platform.OS === 'web' && (
            <Button
              title="Refresh App"
              onPress={handleReload}
              variant="outline"
              fullWidth
              style={styles.actionBtn}
            />
          )}
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="danger"
            fullWidth
            style={styles.actionBtn}
          />
        </View>

        <Text style={styles.version}>Magnify v1.0.0 · Stake Callings Workflow</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[800],
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.gray[800],
    fontWeight: '600',
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: Colors.success + '15',
    borderColor: Colors.success,
  },
  statusPending: {
    backgroundColor: Colors.warning + '15',
    borderColor: Colors.warning,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  statusTextApproved: { color: Colors.success },
  statusTextPending: { color: Colors.warning },
  emptyUsers: {
    padding: Spacing.sm,
    alignItems: 'center',
  },
  emptyUsersText: {
    fontSize: FontSize.sm,
    color: Colors.gray[400],
    fontStyle: 'italic',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: 1,
  },
  userRole: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  approveBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.success,
  },
  approveBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  rejectBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  rejectBtnText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btnDisabled: { opacity: 0.5 },
  actionBtn: { marginBottom: Spacing.sm },
  version: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
});
