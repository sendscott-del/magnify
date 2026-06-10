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

// Read-only view of pending Magnify access requests. Approvals and
// rejections moved to the Gather hub, which manages access for all apps
// on the shared Supabase project.
export function PendingAccessScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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
              <Text style={styles.userRoleLabel}>{t('pending.requestedRole')}</Text>
              <Text style={styles.userRoleValue}>{ROLE_LABELS[u.role as UserRole] ?? u.role}</Text>
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
});
