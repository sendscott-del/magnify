import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';

const ROLES = [
  { key: 'stake_president', label: 'Stake President' },
  { key: 'first_counselor', label: '1st Counselor' },
  { key: 'second_counselor', label: '2nd Counselor' },
  { key: 'stake_clerk', label: 'Stake Clerk' },
  { key: 'exec_secretary', label: 'Exec Secretary' },
  { key: 'high_councilor', label: 'High Councilor' },
];

type PermValue = boolean | string;

interface Permission {
  label: string;
  values: Record<string, PermValue>;
  note?: string;
}

const PERMISSIONS: Permission[] = [
  {
    label: 'SP Board Access',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: false,
    },
  },
  {
    label: 'Advance: For Approval',
    values: {
      stake_president: 'Anytime',
      first_counselor: 'All 3 approved',
      second_counselor: 'All 3 approved',
      stake_clerk: 'All 3 approved',
      exec_secretary: false,
      high_councilor: false,
    },
    note: 'Stake President can advance unilaterally. Others require all three presidency members to have approved.',
  },
  {
    label: 'HC Board Access',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: true,
    },
  },
  {
    label: 'Advance: HC Approval',
    values: {
      stake_president: 'Anytime',
      first_counselor: 'Anytime',
      second_counselor: 'Anytime',
      stake_clerk: 'Anytime',
      exec_secretary: false,
      high_councilor: '>50% approved',
    },
    note: 'SP and Stake Clerk can advance without waiting for HC votes. HC members need more than 50% of active HC members to approve.',
  },
  {
    label: 'Decline Callings',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: true,
    },
    note: 'All users can decline a calling (except at Ideas or Complete stage).',
  },
  {
    label: 'See Declined Cards',
    values: {
      stake_president: true,
      first_counselor: false,
      second_counselor: false,
      stake_clerk: false,
      exec_secretary: false,
      high_councilor: false,
    },
    note: 'Only the Stake President can see the Declined column on the SP Board.',
  },
  {
    label: 'Delete Callings',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: false,
    },
  },
  {
    label: 'Move Back Stage',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: false,
    },
  },
  {
    label: 'Manage Users & Settings',
    values: {
      stake_president: true,
      first_counselor: false,
      second_counselor: false,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: false,
    },
    note: 'Includes approving/rejecting user accounts, Slack settings, and managing SP/HC rosters.',
  },
];

function PermCell({ value }: { value: PermValue }) {
  if (value === true) {
    return (
      <View style={[styles.cell, styles.cellYes]}>
        <Ionicons name="checkmark" size={14} color={Colors.success} />
      </View>
    );
  }
  if (value === false) {
    return (
      <View style={[styles.cell, styles.cellNo]}>
        <Text style={styles.cellNoText}>—</Text>
      </View>
    );
  }
  return (
    <View style={[styles.cell, styles.cellPartial]}>
      <Text style={styles.cellPartialText} numberOfLines={2}>{value as string}</Text>
    </View>
  );
}

export function PermissionsTableScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Access Permissions</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          This table shows what each role can do in Magnify. To change a role's permissions, contact your app administrator.
        </Text>

        {PERMISSIONS.map((perm) => (
          <View key={perm.label} style={styles.section}>
            <Text style={styles.permLabel}>{perm.label}</Text>
            <View style={styles.roleRow}>
              {ROLES.map((role) => (
                <View key={role.key} style={styles.roleCol}>
                  <Text style={styles.roleHeader} numberOfLines={2}>{role.label}</Text>
                  <PermCell value={perm.values[role.key]} />
                </View>
              ))}
            </View>
            {perm.note && <Text style={styles.note}>{perm.note}</Text>}
          </View>
        ))}

        <DisclaimerFooter />

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendCell}>
              <Ionicons name="checkmark" size={14} color={Colors.success} />
            </View>
            <Text style={styles.legendText}>Permitted</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendCell, styles.cellNo]}>
              <Text style={styles.cellNoText}>—</Text>
            </View>
            <Text style={styles.legendText}>Not permitted</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendCell, styles.cellPartial]}>
              <Text style={styles.cellPartialText}>Cond.</Text>
            </View>
            <Text style={styles.legendText}>Permitted with conditions (see note)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  backBtn: { padding: 4 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  intro: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  permLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  roleCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  roleHeader: {
    fontSize: 9,
    color: Colors.gray[500],
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },
  cell: {
    width: '100%',
    minHeight: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  cellYes: { backgroundColor: Colors.success + '18' },
  cellNo: { backgroundColor: Colors.gray[100] },
  cellNoText: { fontSize: 12, color: Colors.gray[400], fontWeight: '600' },
  cellPartial: { backgroundColor: Colors.warning + '20' },
  cellPartialText: { fontSize: 8, color: Colors.warning, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  note: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: Spacing.sm,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  legend: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  legendTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gray[700],
    marginBottom: Spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  legendCell: {
    width: 36,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    backgroundColor: Colors.success + '18',
    flexShrink: 0,
  },
  legendText: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    flex: 1,
  },
});
