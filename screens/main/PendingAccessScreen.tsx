import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/database.types';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';

const GATHER_URL = 'https://gather.gatheredin.app/gather';

const APPROVABLE_ROLES: UserRole[] = [
  'stake_president', 'first_counselor', 'second_counselor',
  'high_councilor', 'stake_clerk', 'exec_secretary',
];

// Pending Magnify access requests for YOUR stake. Stake admins approve or
// deny their own members here (delegated approval); the Gather hub remains
// the suite-wide surface. Also hosts invite codes — the way a stake's
// members land in the right stake when they sign up.
export function PendingAccessScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [armDenyId, setArmDenyId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchPendingUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('app', 'magnify').eq('status', 'pending').order('created_at');
    setPendingUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchPendingUsers(); }, [fetchPendingUsers]));

  function openGather() {
    if (Platform.OS === 'web') window.open(GATHER_URL, '_blank');
    else Linking.openURL(GATHER_URL);
  }

  async function approveAs(userId: string, role: UserRole) {
    setBusyId(userId);
    setError('');
    const { error: err } = await supabase.rpc('magnify_approve_member', { p_user_id: userId, p_role: role });
    if (err) setError(err.message.replace(/^.*magnify_approve_member:\s*/, ''));
    setBusyId(null);
    setExpandedId(null);
    await fetchPendingUsers();
  }

  async function denyUser(userId: string) {
    if (armDenyId !== userId) { setArmDenyId(userId); return; }
    setBusyId(userId);
    setError('');
    const { error: err } = await supabase.rpc('magnify_deny_member', { p_user_id: userId });
    if (err) setError(err.message.replace(/^.*magnify_deny_member:\s*/, ''));
    setBusyId(null);
    setArmDenyId(null);
    await fetchPendingUsers();
  }

  async function createInvite() {
    setInviteBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('gather_create_stake_invite');
    if (err) setError(err.message.replace(/^.*gather_create_stake_invite:\s*/, ''));
    else setInviteCode(data as string);
    setInviteBusy(false);
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
        <View style={styles.gatherBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gatherNote}>{t('pendingAccess.gatherNote')}</Text>
            <TouchableOpacity style={styles.gatherBtn} onPress={openGather}>
              <Text style={styles.gatherBtnText}>{t('pendingAccess.manageInGather')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invite members */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>{t('pendingAccess.inviteTitle')}</Text>
          <Text style={styles.inviteHint}>{t('pendingAccess.inviteHint')}</Text>
          {inviteCode ? (
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText} selectable>{inviteCode}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.inviteBtn, inviteBusy && { opacity: 0.5 }]}
              onPress={createInvite}
              disabled={inviteBusy}
            >
              <Text style={styles.inviteBtnText}>{inviteBusy ? '…' : t('pendingAccess.createInvite')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />
        ) : pendingUsers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('settings.noPending')}</Text>
          </View>
        ) : (
          pendingUsers.map(u => {
            const busy = busyId === u.id;
            const expanded = expandedId === u.id;
            const armed = armDenyId === u.id;
            return (
              <View key={u.id} style={styles.userCard}>
                <Text style={styles.userName}>{u.full_name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                <Text style={styles.userRoleLabel}>{t('pending.requestedRole')}</Text>
                <Text style={styles.userRoleValue}>{ROLE_LABELS[u.role as UserRole] ?? u.role}</Text>
                <View style={styles.decisionRow}>
                  <TouchableOpacity
                    style={[styles.approveBtn, busy && { opacity: 0.5 }]}
                    onPress={() => { setArmDenyId(null); setExpandedId(expanded ? null : u.id); }}
                    disabled={busy}
                  >
                    <Text style={styles.approveBtnText}>{t('pendingAccess.approveAs')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.denyBtn, armed && styles.denyBtnArmed, busy && { opacity: 0.5 }]}
                    onPress={() => denyUser(u.id)}
                    disabled={busy}
                  >
                    <Text style={[styles.denyBtnText, armed && styles.denyBtnTextArmed]}>
                      {armed ? t('pendingAccess.reallyDeny') : t('pendingAccess.deny')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {expanded && (
                  <View style={styles.roleChips}>
                    {APPROVABLE_ROLES.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.roleChip, busy && { opacity: 0.5 }]}
                        onPress={() => approveAs(u.id, r)}
                        disabled={busy}
                      >
                        <Text style={styles.roleChipText}>{ROLE_LABELS[r]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })
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
  gatherBanner: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primaryFade, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary, marginBottom: Spacing.md,
  },
  gatherNote: { fontSize: FontSize.sm, color: Colors.gray[700], lineHeight: 20 },
  gatherBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.primary,
  },
  gatherBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
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
  userRoleLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], marginTop: Spacing.sm },
  userRoleValue: { fontSize: FontSize.sm, color: Colors.gray[800], fontWeight: '500' },
  inviteCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  inviteTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  inviteHint: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2, lineHeight: 18 },
  inviteBtn: {
    alignSelf: 'flex-start', marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.primary,
  },
  inviteBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  inviteCodeBox: {
    marginTop: Spacing.sm, backgroundColor: Colors.gray[50], borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.gray[200], padding: Spacing.sm, alignItems: 'center',
  },
  inviteCodeText: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary, letterSpacing: 2 },
  errorText: { fontSize: FontSize.sm, color: Colors.error, marginBottom: Spacing.sm },
  decisionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  approveBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.primary,
  },
  approveBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  denyBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: '#fef2f2',
    borderWidth: 1, borderColor: '#fecaca',
  },
  denyBtnArmed: { backgroundColor: Colors.error, borderColor: Colors.error },
  denyBtnText: { color: '#b91c1c', fontSize: FontSize.sm, fontWeight: '700' },
  denyBtnTextArmed: { color: Colors.white },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primaryFade,
  },
  roleChipText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
});
