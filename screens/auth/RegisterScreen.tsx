import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { notifyAccessRequest } from '../../lib/slack';

export function RegisterScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const { t } = useLanguage();
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('register.title')}</Text>
      <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

      <Input
        label={t('register.fullName')}
        value={fullName}
        onChangeText={setFullName}
        placeholder={t('register.fullNamePlaceholder')}
      />
      <Input
        label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('register.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        isPassword
        placeholder={t('register.passwordPlaceholder')}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    minHeight: '100%' as any,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.gray[500],
    marginBottom: Spacing.lg,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  btn: { marginTop: Spacing.md },
  backLink: { alignItems: 'center', marginTop: Spacing.md },
  backLinkText: { color: Colors.primary, fontSize: FontSize.sm },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
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
