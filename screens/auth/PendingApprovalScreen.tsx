import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from '../../components/ui/KeyboardAwareScrollView';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { UserRole } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export function PendingApprovalScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [requestOpen, setRequestOpen] = useState(false);
  const [stakeName, setStakeName] = useState('');
  const [stakeAbbr, setStakeAbbr] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestErr, setRequestErr] = useState('');

  async function submitStakeRequest() {
    const name = stakeName.trim();
    if (!name || !user) return;
    setRequestBusy(true);
    setRequestErr('');
    const { error } = await supabase.from('stake_requests').insert({
      requester_user_id: user.id,
      proposed_name: name,
      proposed_abbreviation: stakeAbbr.trim() || null,
    });
    setRequestBusy(false);
    if (error) setRequestErr(error.message);
    else setRequestSent(true);
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>{t('pending.title')}</Text>
      <Text style={styles.desc}>{t('pending.desc')}</Text>
      {profile ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('pending.name')}</Text>
          <Text style={styles.infoValue}>{profile.full_name}</Text>
          <Text style={styles.infoLabel}>{t('pending.email')}</Text>
          <Text style={styles.infoValue}>{profile.email}</Text>
          <Text style={styles.infoLabel}>{t('pending.requestedRole')}</Text>
          <Text style={styles.infoValue}>{ROLE_LABELS[profile.role as UserRole] ?? profile.role}</Text>
        </View>
      ) : (
        // No Magnify profile row exists for this account (e.g. it belongs to
        // another app on the shared Supabase project). Show the signed-in
        // email from the auth session so the user knows which account this is.
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>{t('pending.email')}</Text>
          <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
        </View>
      )}
      <Button
        title={t('pending.refreshStatus')}
        onPress={refreshProfile}
        variant="outline"
        fullWidth
        style={styles.btn}
      />
      <Button
        title={t('pending.signOut')}
        onPress={signOut}
        variant="ghost"
        fullWidth
        style={{ marginTop: Spacing.sm }}
      />

      {/* Vetted "create your stake" path: writes a stake_request that the
          platform owner approves in the Gather hub; on approval this account
          becomes that stake's first admin. */}
      <View style={styles.requestBox}>
        {requestSent ? (
          <Text style={styles.requestSent}>{t('pending.stakeRequestSent')}</Text>
        ) : (
          <>
            <Text style={styles.requestQ}>{t('pending.otherStakeQ')}</Text>
            {requestOpen ? (
              <>
                <TextInput
                  style={styles.requestInput}
                  value={stakeName}
                  onChangeText={setStakeName}
                  placeholder={t('pending.stakeName')}
                  placeholderTextColor={Colors.gray[400]}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.requestInput}
                  value={stakeAbbr}
                  onChangeText={setStakeAbbr}
                  placeholder={t('pending.stakeAbbr')}
                  placeholderTextColor={Colors.gray[400]}
                  autoCapitalize="characters"
                />
                {requestErr ? <Text style={styles.requestErr}>{requestErr}</Text> : null}
                <Button
                  title={requestBusy ? '…' : t('pending.submitStakeRequest')}
                  onPress={submitStakeRequest}
                  fullWidth
                  disabled={requestBusy || !stakeName.trim()}
                  style={{ marginTop: Spacing.xs }}
                />
              </>
            ) : (
              <TouchableOpacity onPress={() => setRequestOpen(true)}>
                <Text style={styles.requestLink}>{t('pending.requestStake')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.gray[50],
  },
  requestBox: {
    width: '100%',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    alignItems: 'center',
  },
  requestQ: { fontSize: FontSize.sm, color: Colors.gray[500] },
  requestLink: {
    fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700',
    marginTop: Spacing.xs, padding: Spacing.xs,
  },
  requestInput: {
    width: '100%', backgroundColor: Colors.white, borderWidth: 1.5,
    borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    fontSize: FontSize.sm, color: Colors.black, marginTop: Spacing.sm,
  },
  requestErr: { fontSize: FontSize.xs, color: Colors.error, marginTop: Spacing.xs },
  requestSent: {
    fontSize: FontSize.sm, color: Colors.success, fontWeight: '600',
    textAlign: 'center', lineHeight: 20,
  },
  icon: { fontSize: 56, marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.md,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  infoValue: {
    fontSize: FontSize.md,
    color: Colors.gray[800],
    fontWeight: '500',
  },
  btn: { marginTop: Spacing.sm },
});
