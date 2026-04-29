import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { useLanguage } from '../../context/LanguageContext';

type PermValue = boolean | string;

interface Permission {
  labelKey: string;
  values: Record<string, PermValue>;
  noteKey?: string;
}

const ROLE_KEYS = [
  'stake_president',
  'first_counselor',
  'second_counselor',
  'stake_clerk',
  'exec_secretary',
  'high_councilor',
];

const PERMISSIONS: Permission[] = [
  {
    labelKey: 'permissions.spBoard',
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
    labelKey: 'permissions.advanceForApproval',
    values: {
      stake_president: 'anytime',
      first_counselor: 'all3',
      second_counselor: 'all3',
      stake_clerk: 'all3',
      exec_secretary: false,
      high_councilor: false,
    },
    noteKey: 'permissions.advanceForApprovalNote',
  },
  {
    labelKey: 'permissions.hcBoard',
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
    labelKey: 'permissions.advanceHC',
    values: {
      stake_president: 'anytime',
      first_counselor: 'anytime',
      second_counselor: 'anytime',
      stake_clerk: 'anytime',
      exec_secretary: false,
      high_councilor: '50pct',
    },
    noteKey: 'permissions.advanceHCNote',
  },
  {
    labelKey: 'permissions.declineCallings',
    values: {
      stake_president: true,
      first_counselor: true,
      second_counselor: true,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: true,
    },
    noteKey: 'permissions.declineCallingNote',
  },
  {
    labelKey: 'permissions.seeDeclined',
    values: {
      stake_president: true,
      first_counselor: false,
      second_counselor: false,
      stake_clerk: false,
      exec_secretary: false,
      high_councilor: false,
    },
    noteKey: 'permissions.seeDeclinedNote',
  },
  {
    labelKey: 'permissions.deleteCallings',
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
    labelKey: 'permissions.moveBack',
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
    labelKey: 'permissions.manageUsers',
    values: {
      stake_president: true,
      first_counselor: false,
      second_counselor: false,
      stake_clerk: true,
      exec_secretary: true,
      high_councilor: false,
    },
    noteKey: 'permissions.manageUsersNote',
  },
];

function PermCell({ value, t }: { value: PermValue; t: (key: string) => string }) {
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
  // Resolve token strings to translated labels
  let displayValue: string;
  if (value === 'anytime') {
    displayValue = t('permissions.advanceForApprovalAnytime');
  } else if (value === 'all3') {
    displayValue = t('permissions.advanceForApprovalAll3');
  } else if (value === '50pct') {
    displayValue = t('permissions.advanceHC50');
  } else {
    displayValue = value as string;
  }
  return (
    <View style={[styles.cell, styles.cellPartial]}>
      <Text style={styles.cellPartialText} numberOfLines={2}>{displayValue}</Text>
    </View>
  );
}

export function PermissionsTableScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const roleLabels: Record<string, string> = {
    stake_president: t('role.stake_president'),
    first_counselor: t('role.first_counselor'),
    second_counselor: t('role.second_counselor'),
    stake_clerk: t('role.stake_clerk'),
    exec_secretary: t('role.exec_secretary'),
    high_councilor: t('role.high_councilor'),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('permissions.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>{t('permissions.intro')}</Text>

        {PERMISSIONS.map((perm) => (
          <View key={perm.labelKey} style={styles.section}>
            <Text style={styles.permLabel}>{t(perm.labelKey as any)}</Text>
            <View style={styles.roleRow}>
              {ROLE_KEYS.map((roleKey) => (
                <View key={roleKey} style={styles.roleCol}>
                  <Text style={styles.roleHeader} numberOfLines={2}>{roleLabels[roleKey]}</Text>
                  <PermCell value={perm.values[roleKey]} t={t as (key: string) => string} />
                </View>
              ))}
            </View>
            {perm.noteKey && <Text style={styles.note}>{t(perm.noteKey as any)}</Text>}
          </View>
        ))}

        <DisclaimerFooter />

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{t('permissions.legend')}</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendCell}>
              <Ionicons name="checkmark" size={14} color={Colors.success} />
            </View>
            <Text style={styles.legendText}>{t('permissions.permitted')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendCell, styles.cellNo]}>
              <Text style={styles.cellNoText}>—</Text>
            </View>
            <Text style={styles.legendText}>{t('permissions.notPermitted')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendCell, styles.cellPartial]}>
              <Text style={styles.cellPartialText}>{t('permissions.condShort')}</Text>
            </View>
            <Text style={styles.legendText}>{t('permissions.conditionalPermit')}</Text>
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
