import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Magnify</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.heading}>{t('forgotPassword.title')}</Text>

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
              <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
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
            <Text style={styles.switchText}>
              <Text style={styles.switchLink}>{t('forgotPassword.backToSignIn')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.white },
  container: { padding: Spacing.lg, flexGrow: 1 },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xl },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginBottom: Spacing.md,
  },
  appName: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.primary },
  form: { flex: 1 },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginBottom: Spacing.lg,
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
  switchText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  switchLink: { color: Colors.primary, fontWeight: '600' },
});
