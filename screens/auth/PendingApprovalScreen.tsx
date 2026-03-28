import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { UserRole } from '../../lib/database.types';

export function PendingApprovalScreen() {
  const { profile, signOut, refreshProfile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Awaiting Approval</Text>
      <Text style={styles.desc}>
        Your account has been created and is pending approval by the Stake Clerk or Stake
        Presidency.
      </Text>
      {profile && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{profile.full_name}</Text>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{profile.email}</Text>
          <Text style={styles.infoLabel}>Requested Role</Text>
          <Text style={styles.infoValue}>{ROLE_LABELS[profile.role as UserRole]}</Text>
        </View>
      )}
      <Button
        title="Refresh Status"
        onPress={refreshProfile}
        variant="outline"
        fullWidth
        style={styles.btn}
      />
      <Button
        title="Sign Out"
        onPress={signOut}
        variant="ghost"
        fullWidth
        style={{ marginTop: Spacing.sm }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.gray[50],
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
