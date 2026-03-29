import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

export function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError(t('login.fillAllFields'));
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError(err.message);
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
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>⛪</Text>
          </View>
          <Text style={styles.appName}>Magnify</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.heading}>{t('login.welcomeBack')}</Text>
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
          <Input
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            isPassword
            leftIcon="lock-closed-outline"
            placeholder={t('login.passwordPlaceholder')}
          />

          <Button
            title={t('login.signIn')}
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.signInBtn}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {t('login.noAccount')}{' '}
              <Text style={styles.switchLink}>{t('login.createAccount')}</Text>
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
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.primary },
  tagline: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 4 },
  form: { flex: 1 },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.gray[900],
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
  signInBtn: { marginTop: Spacing.sm },
  switchRow: { alignItems: 'center', marginTop: Spacing.lg },
  switchText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  switchLink: { color: Colors.primary, fontWeight: '600' },
});
