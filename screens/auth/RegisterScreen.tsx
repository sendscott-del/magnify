import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { UserRole } from '../../lib/database.types';
import { ROLE_LABELS } from '../../constants/callings';
import { notifyAccessRequest } from '../../lib/slack';

export function RegisterScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('stake_clerk');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const roles: UserRole[] = [
    'stake_president',
    'first_counselor',
    'second_counselor',
    'high_councilor',
    'stake_clerk',
    'exec_secretary',
  ];

  async function handleRegister() {
    if (!fullName || !email || !password) {
      setError(t('register.fillAllFields'));
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, password, fullName, role);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    notifyAccessRequest({ name: fullName, email, role: ROLE_LABELS[role] }).catch(() => {});
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

      <Text style={styles.roleLabel}>{t('register.yourRole')}</Text>
      <View style={styles.roleGrid}>
        {roles.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.roleChip, role === r && styles.roleChipActive]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
              {ROLE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
  roleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  roleChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  roleChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFade,
  },
  roleChipText: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
  },
  roleChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
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
