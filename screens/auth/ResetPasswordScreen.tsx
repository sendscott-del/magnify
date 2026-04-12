import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

export function ResetPasswordScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleUpdate() {
    if (!password || !confirmPassword) {
      setError(t('resetPassword.fillAllFields'));
      return;
    }
    if (password.length < 8) {
      setError(t('resetPassword.minLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.noMatch'));
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
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
          <Text style={styles.heading}>{t('resetPassword.title')}</Text>

          {success ? (
            <View>
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{t('resetPassword.success')}</Text>
              </View>
              <Button
                title={t('resetPassword.continue')}
                onPress={onComplete}
                fullWidth
                size="lg"
                style={styles.btn}
              />
            </View>
          ) : (
            <View>
              <Text style={styles.subtitle}>{t('resetPassword.subtitle')}</Text>
              {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

              <Input
                label={t('resetPassword.newPassword')}
                value={password}
                onChangeText={setPassword}
                isPassword
                leftIcon="lock-closed-outline"
                placeholder={t('register.passwordPlaceholder')}
              />
              <Input
                label={t('resetPassword.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                leftIcon="lock-closed-outline"
                placeholder={t('register.passwordPlaceholder')}
              />

              <Button
                title={t('resetPassword.updatePassword')}
                onPress={handleUpdate}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.btn}
              />
            </View>
          )}
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
});
