import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { MagnifyLogo } from '../../components/icons/MagnifyLogo';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

export function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      setError(t('forgotPassword.enterEmail'));
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}/reset-password`,
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.gray[50] }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.xxl }]}>
          <View style={styles.brandRow}>
            <MagnifyLogo size={44} />
            <View>
              <Text style={styles.brandName}>Magnify</Text>
              <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
            </View>
          </View>
          <Text style={styles.heroHeading}>{t('forgotPassword.title')}</Text>
          <Text style={styles.heroSub}>{t('forgotPassword.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <View>
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{t('forgotPassword.sent')}</Text>
              </View>
              <Button
                title={t('forgotPassword.backToSignIn')}
                onPress={() => navigation.navigate('Login')}
                fullWidth
                size="lg"
                style={styles.btn}
              />
            </View>
          ) : (
            <View>
              {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

              <Input
                label={t('login.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
                placeholder={t('login.emailPlaceholder')}
              />

              <Button
                title={t('forgotPassword.sendLink')}
                onPress={handleReset}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.btn}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.switchRow}
          >
            <Text style={styles.switchLink}>{t('forgotPassword.backToSignIn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.gray[50] },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.xxl },
  hero: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl + Spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  logoMark: { width: 44, height: 44, borderRadius: Radius.md },
  brandName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  brandTagline: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  heroHeading: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  card: {
    marginTop: -Spacing.xxl,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    color: Colors.error,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
    fontSize: FontSize.sm,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  successText: {
    color: '#166534',
    fontSize: FontSize.sm,
  },
  btn: { marginTop: Spacing.sm },
  switchRow: { alignItems: 'center', marginTop: Spacing.lg },
  switchLink: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
});
