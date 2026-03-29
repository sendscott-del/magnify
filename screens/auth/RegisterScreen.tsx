import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { UserRole } from '../../lib/database.types';
import { ROLE_LABELS } from '../../constants/callings';
import { notifyAccessRequest } from '../../lib/slack';

export function RegisterScreen({ navigation }: any) {
  const { signUp } = useAuth();
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
      setError('Please fill in all fields.');
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
        <Text style={styles.successTitle}>Account Created</Text>
        <Text style={styles.successDesc}>
          Your account is pending approval by the Stake Clerk or Stake Presidency. You'll be able
          to log in once approved.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Request access to Magnify</Text>

      <Input
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Your full name"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        isPassword
        placeholder="At least 8 characters"
      />

      <Text style={styles.roleLabel}>Your Role</Text>
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
        title="Request Access"
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
        <Text style={styles.backLinkText}>Already have an account? Sign In</Text>
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
