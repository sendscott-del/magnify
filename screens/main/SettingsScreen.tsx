import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../lib/database.types';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { CHANGELOG } from '../../constants/changelog';
import { useLanguage } from '../../context/LanguageContext';
import { useDemoMode } from '../../context/DemoModeContext';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
  last?: boolean;
}

function Row({ icon, label, sub, right, onPress, chevron = true, danger, last }: RowProps) {
  const Touchable: any = onPress ? TouchableOpacity : View;
  return (
    <Touchable
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={[styles.row, last && styles.rowLast]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={16} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
      {chevron && !right && (
        <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
      )}
    </Touchable>
  );
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {label && <Text style={styles.sectionLabel}>{label}</Text>}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[styles.toggleTrack, on && styles.toggleTrackOn]}>
      <View style={[styles.toggleThumb, on && styles.toggleThumbOn]} />
    </TouchableOpacity>
  );
}

function Segmented({ options, active, onChange }: { options: { value: string; label: string }[]; active: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.seg}>
      {options.map(o => (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segBtn, active === o.value && styles.segBtnActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.segText, active === o.value && styles.segTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile, signOut, isAdmin } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { demoMode, setDemoMode } = useDemoMode();
  const [pendingCount, setPendingCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [slackActive, setSlackActive] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;
    const [pending, users, slack] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('slack_settings').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);
    setPendingCount(pending.count ?? 0);
    setUserCount(users.count ?? 0);
    setSlackActive(slack.count ?? 0);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { fetchCounts(); }, [fetchCounts]));

  function handleSignOut() {
    if (Platform.OS === 'web') {
      if (window.confirm(t('settings.signOutConfirm'))) signOut();
    } else {
      Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
        { text: t('detail.cancel'), style: 'cancel' },
        { text: t('settings.signOut'), style: 'destructive', onPress: signOut },
      ]);
    }
  }

  function handleReload() {
    if (Platform.OS === 'web') window.location.reload();
  }

  function openGather() {
    const url = 'https://stewards-indeed.vercel.app/admin/gather';
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  }

  const initials = (profile?.full_name ?? '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const version = CHANGELOG[0]?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '—'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.profileTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.profileName} numberOfLines={1}>{profile?.full_name ?? '—'}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email ?? ''}</Text>
              </View>
              {profile?.status === 'approved' && (
                <View style={styles.approvedChip}>
                  <Text style={styles.approvedChipText}>{t('settings.approved').toLowerCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileRoleRow}>
              <Text style={styles.profileRoleLabel}>{t('settings.roleLabel')}</Text>
              <Text style={styles.profileRoleValue}>
                {profile ? ROLE_LABELS[profile.role as UserRole] : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Admin */}
        {isAdmin && (
          <Section label={t('settings.adminSection')}>
            <Row
              icon="time-outline"
              label={t('settings.pendingAccess')}
              sub={t('settings.pendingAccessSub')}
              right={pendingCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              ) : undefined}
              onPress={() => navigation.navigate('PendingAccess')}
            />
            <Row
              icon="people-outline"
              label={t('settings.userRoles')}
              sub={`${userCount} ${t('settings.usersSub')}`}
              onPress={() => navigation.navigate('UserRoles')}
              last
            />
          </Section>
        )}

        {/* Integrations */}
        {isAdmin && (
          <Section label={t('settings.integrationsSection')}>
            <Row
              icon="chatbubble-ellipses-outline"
              label={t('settings.slackNotifications')}
              sub={`${slackActive} ${t('settings.slackSubOf')} 5 ${t('settings.slackSubActive')}`}
              onPress={() => navigation.navigate('SlackSettings')}
              last
            />
          </Section>
        )}

        {/* Preferences */}
        <Section label={t('settings.preferencesSection')}>
          <Row
            icon="language-outline"
            label={t('settings.language')}
            chevron={false}
            right={
              <Segmented
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'es', label: 'ES' },
                ]}
                active={language}
                onChange={(v) => setLanguage(v as any)}
              />
            }
          />
          <Row
            icon="contrast-outline"
            label={t('settings.demoMode')}
            chevron={false}
            right={<Toggle on={demoMode} onPress={() => setDemoMode(!demoMode)} />}
            last
          />
        </Section>

        {/* Help */}
        <Section label={t('settings.helpSection')}>
          <Row
            icon="help-circle-outline"
            label={t('settings.userGuide')}
            sub={t('settings.userGuideSub')}
            onPress={() => navigation.navigate('Help')}
          />
          <Row
            icon="sparkles-outline"
            label={t('settings.releaseNotes')}
            right={<Text style={styles.versionRight}>v{version}</Text>}
            chevron={false}
            onPress={() => navigation.navigate('ReleaseNotes')}
            last
          />
        </Section>

        {/* App */}
        <Section label={t('settings.appSection')}>
          {Platform.OS === 'web' && (
            <Row
              icon="refresh-outline"
              label={t('settings.refreshApp')}
              onPress={handleReload}
            />
          )}
          {(profile?.role === 'stake_president' || profile?.role === 'stake_clerk') && (
            <Row
              icon="open-outline"
              label={t('settings.manageGather')}
              onPress={openGather}
            />
          )}
          <Row
            icon="log-out-outline"
            label={t('settings.signOut')}
            danger
            chevron={false}
            onPress={handleSignOut}
            last
          />
        </Section>

        <Text style={styles.version}>Magnify v{version} · Stake Callings Workflow</Text>
        <DisclaimerFooter />
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
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },

  // Profile
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  avatar: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  profileTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  profileName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  profileEmail: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  approvedChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.success + '18',
    borderWidth: 1,
    borderColor: Colors.success + '50',
  },
  approvedChipText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700' },
  profileRoleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  profileRoleLabel: { fontSize: FontSize.xs, color: Colors.gray[500] },
  profileRoleValue: { fontSize: FontSize.xs, color: Colors.gray[800], fontWeight: '700' },

  // Section
  section: { marginBottom: Spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray[500],
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    minHeight: 52,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: Colors.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: Colors.error + '15' },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: FontSize.sm, color: Colors.gray[900], fontWeight: '500' },
  rowLabelDanger: { color: Colors.error, fontWeight: '700' },
  rowSub: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },

  // Badge
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: Colors.warning,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '800' },

  // Toggle
  toggleTrack: {
    width: 40, height: 24, borderRadius: 12,
    backgroundColor: Colors.gray[300],
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: Colors.success },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.white,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2, elevation: 2 }),
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Segmented
  seg: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    borderRadius: 8,
    padding: 2,
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: Colors.white,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 }),
  },
  segText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500] },
  segTextActive: { color: Colors.primary, fontWeight: '700' },

  versionRight: { fontSize: FontSize.xs, color: Colors.gray[500], fontWeight: '600' },
  version: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
});
