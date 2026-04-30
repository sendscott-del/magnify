import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MagnifyLogo } from '../../components/icons/MagnifyLogo';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { notifyAccessRequest } from '../../lib/slack';

export function RegisterScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleRegister() {
    if (!fullName || !email || !password) {
      setError(t('register.fillAllFields'));
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, password, fullName, 'stake_clerk');
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    notifyAccessRequest({ name: fullName, email, role: 'Pending' }).catch(() => {});
    setSuccess(true);
  }

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>{t('register.successTitle')}</Text>
        <Text style={styles.successDesc}>{t('register.successDesc')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>{t('register.backToSignIn')}</Text>
        </TouchableOpacity>
      </View>
    );
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
        {/* Navy hero band */}
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.xxl }]}>
          <View style={styles.brandRow}>
            <MagnifyLogo size={44} />
            <View>
              <Text style={styles.brandName}>Magnify</Text>
              <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
            </View>
          </View>
          <Text style={styles.heroHeading}>{t('register.title')}</Text>
          <Text style={styles.heroSub}>{t('register.subtitle')}</Text>
        </View>

        {/* White card overlapping the hero */}
        <View style={styles.card}>
          <Input
            label={t('register.fullName')}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('register.fullNamePlaceholder')}
            leftIcon="person-outline"
          />
          <Input
            label={t('login.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('register.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />
          <Input
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            isPassword
            placeholder={t('register.passwordPlaceholder')}
            leftIcon="lock-closed-outline"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={t('register.requestAccess')}
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.btn}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{t('register.haveAccount')}</Text>
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
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  btn: { marginTop: Spacing.md },
  backLink: { alignItems: 'center', marginTop: Spacing.lg },
  backLinkText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.white,
  },
  successIcon: { fontSize: 48 },
  successTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: Spacing.md,
  },
  successDesc: {
    fontSize: FontSize.md,
    color: Colors.gray[600],
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 24,
  },
});
