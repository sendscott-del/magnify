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
        </Section>

        <Section title={t('help.hcBoard')}>
          <Text style={styles.body}>{t('help.hcBoardBody1')}</Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>{t('help.hcBoardBody2')}</Text>
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
