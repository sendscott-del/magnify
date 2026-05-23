import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { useLanguage } from '../../context/LanguageContext';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Item({ label, description }: { label: string; description: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemDesc}>{description}</Text>
    </View>
  );
}

// ── Permissions matrix (folded in from the old standalone screen) ──
type PermValue = boolean | string;
interface Permission { labelKey: string; values: Record<string, PermValue>; noteKey?: string; }

const PERM_ROLE_KEYS = [
  'stake_president', 'first_counselor', 'second_counselor',
  'stake_clerk', 'exec_secretary', 'high_councilor',
];

const PERMISSIONS: Permission[] = [
  { labelKey: 'permissions.spBoard',
    values: { stake_president: true, first_counselor: true, second_counselor: true, stake_clerk: true, exec_secretary: true, high_councilor: false } },
  { labelKey: 'permissions.advanceForApproval',
    values: { stake_president: 'anytime', first_counselor: 'all3', second_counselor: 'all3', stake_clerk: 'all3', exec_secretary: false, high_councilor: false },
    noteKey: 'permissions.advanceForApprovalNote' },
  { labelKey: 'permissions.hcBoard',
    values: { stake_president: true, first_counselor: true, second_counselor: true, stake_clerk: true, exec_secretary: true, high_councilor: true } },
  { labelKey: 'permissions.advanceHC',
    values: { stake_president: 'anytime', first_counselor: 'anytime', second_counselor: 'anytime', stake_clerk: 'anytime', exec_secretary: false, high_councilor: '50pct' },
    noteKey: 'permissions.advanceHCNote' },
  { labelKey: 'permissions.declineCallings',
    values: { stake_president: true, first_counselor: true, second_counselor: true, stake_clerk: true, exec_secretary: true, high_councilor: true },
    noteKey: 'permissions.declineCallingNote' },
  { labelKey: 'permissions.seeDeclined',
    values: { stake_president: true, first_counselor: false, second_counselor: false, stake_clerk: false, exec_secretary: false, high_councilor: false },
    noteKey: 'permissions.seeDeclinedNote' },
  { labelKey: 'permissions.deleteCallings',
    values: { stake_president: true, first_counselor: true, second_counselor: true, stake_clerk: true, exec_secretary: true, high_councilor: false } },
  { labelKey: 'permissions.moveBack',
    values: { stake_president: true, first_counselor: true, second_counselor: true, stake_clerk: true, exec_secretary: true, high_councilor: false } },
  { labelKey: 'permissions.manageUsers',
    values: { stake_president: true, first_counselor: false, second_counselor: false, stake_clerk: true, exec_secretary: true, high_councilor: false },
    noteKey: 'permissions.manageUsersNote' },
];

function PermCell({ value, t }: { value: PermValue; t: (key: string) => string }) {
  if (value === true) return (
    <View style={[permStyles.cell, permStyles.cellYes]}>
      <Ionicons name="checkmark" size={14} color={Colors.success} />
    </View>
  );
  if (value === false) return (
    <View style={[permStyles.cell, permStyles.cellNo]}>
      <Text style={permStyles.cellNoText}>—</Text>
    </View>
  );
  let displayValue: string;
  if (value === 'anytime') displayValue = t('permissions.advanceForApprovalAnytime');
  else if (value === 'all3') displayValue = t('permissions.advanceForApprovalAll3');
  else if (value === '50pct') displayValue = t('permissions.advanceHC50');
  else displayValue = value as string;
  return (
    <View style={[permStyles.cell, permStyles.cellPartial]}>
      <Text style={permStyles.cellPartialText} numberOfLines={2}>{displayValue}</Text>
    </View>
  );
}

function PermissionsTable({ t }: { t: (key: string) => string }) {
  const roleLabels: Record<string, string> = {
    stake_president: t('role.stake_president'),
    first_counselor: t('role.first_counselor'),
    second_counselor: t('role.second_counselor'),
    stake_clerk: t('role.stake_clerk'),
    exec_secretary: t('role.exec_secretary'),
    high_councilor: t('role.high_councilor'),
  };
  return (
    <>
      <Text style={[styles.body, { marginBottom: Spacing.sm }]}>{t('permissions.intro')}</Text>
      {PERMISSIONS.map(perm => (
        <View key={perm.labelKey} style={permStyles.permBlock}>
          <Text style={permStyles.permLabel}>{t(perm.labelKey)}</Text>
          <View style={permStyles.roleRow}>
            {PERM_ROLE_KEYS.map(roleKey => (
              <View key={roleKey} style={permStyles.roleCol}>
                <Text style={permStyles.roleHeader} numberOfLines={2}>{roleLabels[roleKey]}</Text>
                <PermCell value={perm.values[roleKey]} t={t} />
              </View>
            ))}
          </View>
          {perm.noteKey && <Text style={permStyles.note}>{t(perm.noteKey)}</Text>}
        </View>
      ))}
      <View style={permStyles.legend}>
        <Text style={permStyles.legendTitle}>{t('permissions.legend')}</Text>
        <View style={permStyles.legendRow}>
          <View style={permStyles.legendCell}><Ionicons name="checkmark" size={14} color={Colors.success} /></View>
          <Text style={permStyles.legendText}>{t('permissions.permitted')}</Text>
        </View>
        <View style={permStyles.legendRow}>
          <View style={[permStyles.legendCell, permStyles.cellNo]}><Text style={permStyles.cellNoText}>—</Text></View>
          <Text style={permStyles.legendText}>{t('permissions.notPermitted')}</Text>
        </View>
        <View style={permStyles.legendRow}>
          <View style={[permStyles.legendCell, permStyles.cellPartial]}><Text style={permStyles.cellPartialText}>{t('permissions.condShort')}</Text></View>
          <Text style={permStyles.legendText}>{t('permissions.conditionalPermit')}</Text>
        </View>
      </View>
    </>
  );
}

const permStyles = StyleSheet.create({
  permBlock: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  permLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  roleRow: { flexDirection: 'row', gap: 4 },
  roleCol: { flex: 1, alignItems: 'center', gap: 4 },
  roleHeader: { fontSize: 9, color: Colors.gray[500], fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  cell: { width: '100%', minHeight: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 3 },
  cellYes: { backgroundColor: Colors.success + '18' },
  cellNo: { backgroundColor: Colors.gray[100] },
  cellNoText: { fontSize: 12, color: Colors.gray[400], fontWeight: '600' },
  cellPartial: { backgroundColor: Colors.warning + '20' },
  cellPartialText: { fontSize: 8, color: Colors.warning, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  note: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.xs, lineHeight: 16, fontStyle: 'italic' },
  legend: { marginTop: Spacing.sm },
  legendTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[700], marginBottom: Spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  legendCell: { width: 36, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, backgroundColor: Colors.success + '18', flexShrink: 0 },
  legendText: { fontSize: FontSize.sm, color: Colors.gray[600], flex: 1 },
});

export function HelpScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('help.title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        <Section title={t('help.about')}>
          <Text style={styles.body}>{t('help.aboutBody')}</Text>
        </Section>

        <Section title={t('help.settings')}>
          <Text style={styles.body}>{t('help.settingsBody1')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.settingsBody2')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.settingsBody3')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.settingsBody4')}</Text>
        </Section>

        <Section title={t('help.userRoles')}>
          <Text style={styles.body}>{t('help.userRolesBody')}</Text>
        </Section>

        <Section title={t('help.roles')}>
          <Item
            label={t('role.stake_president')}
            description={t('help.role.stakePresident')}
          />
          <Item
            label={`${t('role.first_counselor')} & ${t('role.second_counselor')}`}
            description={t('help.role.counselors')}
          />
          <Item
            label={t('role.high_councilor')}
            description={t('help.role.highCouncilor')}
          />
          <Item
            label={t('role.stake_clerk')}
            description={t('help.role.stakeClerk')}
          />
          <Item
            label={t('role.exec_secretary')}
            description={t('help.role.execSecretary')}
          />
        </Section>

        <Section title={t('help.accessPermissions')}>
          <PermissionsTable t={t as (key: string) => string} />
        </Section>

        <Section title={t('help.stages')}>
          <Item label={t('stage.ideas')} description={t('help.stage.ideas')} />
          <Item label={t('stage.for_approval')} description={t('help.stage.for_approval')} />
          <Item label={t('stage.stake_approved')} description={t('help.stage.stake_approved')} />
          <Item label={t('stage.hc_approval')} description={t('help.stage.hc_approval')} />
          <Item label={t('stage.issue_calling')} description={t('help.stage.extend')} />
          <Item label={t('stage.sustain')} description={t('help.stage.sustain')} />
          <Item label={t('stage.set_apart')} description={t('help.stage.setApart')} />
          <Item label={t('stage.record')} description={t('help.stage.record')} />
          <Item label={t('stage.complete')} description={t('help.stage.complete')} />
        </Section>

        <Section title={t('help.mpOrdination')}>
          <Text style={styles.body}>{t('help.mpOrdinationBody')}</Text>
        </Section>

        <Section title={t('help.spBoard')}>
          <Text style={styles.body}>{t('help.spBoardBody1')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.spBoardBody2')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.spBoardBody3')}</Text>
        </Section>

        <Section title={t('help.hcBoard')}>
          <Text style={styles.body}>{t('help.hcBoardBody1')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.hcBoardBody2')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.hcBoardBody3')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.hcBoardBody4')}</Text>
        </Section>

        <Section title={t('help.notifications')}>
          <Text style={styles.body}>{t('help.notificationsBody1')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.notificationsBody2')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.notificationsBody3')}</Text>
        </Section>

        <Section title={t('help.slack')}>
          <Text style={styles.body}>{t('help.slackBody')}</Text>
        </Section>

        <Section title={t('help.faq')}>
          <Item
            label={t('help.faq.cantAdvance')}
            description={t('help.faq.cantAdvanceDesc')}
          />
          <Item
            label={t('help.faq.addUser')}
            description={t('help.faq.addUserDesc')}
          />
          <Item
            label={t('help.faq.slack')}
            description={t('help.faq.slackDesc')}
          />
          <Item
            label={t('help.faq.slackId')}
            description={t('help.faq.slackIdDesc')}
          />
          <Item
            label={t('help.faq.undo')}
            description={t('help.faq.undoDesc')}
          />
          <Item
            label={t('help.faq.delete')}
            description={t('help.faq.deleteDesc')}
          />
        </Section>

        <Text style={styles.footer}>{t('help.footer')}</Text>
        <DisclaimerFooter />
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
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.gray[700],
    lineHeight: 20,
  },
  item: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  itemLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gray[900],
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    lineHeight: 18,
  },
  footer: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
});
