import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
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
  const { t, language, setLanguage } = useLanguage();
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
            <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
            <View>
              <Text style={styles.brandName}>Magnify</Text>
              <Text style={styles.brandTagline}>{t('app.tagline')}</Text>
            </View>
          </View>
          <Text style={styles.heroHeading}>{t('login.welcomeBack')}</Text>
          <Text style={styles.heroSub}>{t('login.signInToContinue')}</Text>
        </View>

        {/* White card overlapping the hero */}
        <View style={styles.card}>
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
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotRow}
          >
            <Text style={styles.switchLink}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {t('login.noAccount')}{' '}
              <Text style={styles.switchLink}>{t('login.createAccount')}</Text>
            </Text>
          </TouchableOpacity>

          {/* Language toggle */}
          <View style={styles.langRow}>
            <TouchableOpacity
              onPress={() => setLanguage('en')}
              style={[styles.langSeg, language === 'en' && styles.langSegOn]}
              accessibilityLabel="English"
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'en' }}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextOn]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage('es')}
              style={[styles.langSeg, language === 'es' && styles.langSegOn]}
              accessibilityLabel="Español"
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'es' }}
            >
              <Text style={[styles.langText, language === 'es' && styles.langTextOn]}>Español</Text>
            </TouchableOpacity>
          </View>
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
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
  },
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
  signInBtn: { marginTop: Spacing.sm },
  forgotRow: { alignItems: 'center', marginTop: Spacing.md },
  switchRow: { alignItems: 'center', marginTop: Spacing.lg },
  switchText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  switchLink: { color: Colors.primary, fontWeight: '600' },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.lg,
  },
  langSeg: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  langSegOn: {
    backgroundColor: Colors.primaryFade,
  },
  langText: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    fontWeight: '600',
  },
  langTextOn: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
