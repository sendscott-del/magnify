import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Documentation</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        <Section title="About Magnify">
          <Text style={styles.body}>
            Magnify is a stake callings workflow management tool for The Church of Jesus Christ of Latter-day Saints. It tracks callings from initial consideration through final recording, ensuring the right people take action at each stage.
          </Text>
        </Section>

        <Section title="User Roles">
          <Item
            label="Stake President"
            description="Full access. Approves callings on the SP Board, manages the full workflow. Can approve user accounts and manage membership lists."
          />
          <Item
            label="First & Second Counselor"
            description="Access to the SP Board. Can advance callings from Ideas to For Approval, and approve callings to Stake Approved."
          />
          <Item
            label="High Councilor"
            description="Access to the HC Board. Approves callings at the HC Approval stage and performs extend, sustain, set apart, and record tasks."
          />
          <Item
            label="Stake Clerk"
            description="Full admin access. Can manage all users, SP/HC member lists, Slack settings, move cards back, and delete entries."
          />
          <Item
            label="Executive Secretary"
            description="Admin access to manage users and HC members. Can update HC tasks (extend, sustain, set apart, record)."
          />
        </Section>

        <Section title="Calling Workflow Stages">
          <Item label="Ideas" description="A calling has been identified for consideration. Visible on the SP Board." />
          <Item label="For Approval" description="Submitted to the Stake Presidency for review and approval." />
          <Item label="Stake Approved" description="Approved by the Stake Presidency. Ready for High Council action." />
          <Item label="HC Approval" description="High Councilors vote to approve. At least 50% must approve (or Stake President overrides)." />
          <Item label="Extend Calling" description="An HC member or stake presidency member extends the calling to the member." />
          <Item label="Sustain" description="The member is presented and sustained in their ward. For stake callings the member is sustained in all wards." />
          <Item label="Set Apart" description="A blessing is performed to set the member apart in their calling." />
          <Item label="Record" description="The calling is recorded in Church records." />
          <Item label="Complete" description="The calling is fully processed and moved to Completed." />
        </Section>

        <Section title="MP Ordination Workflow">
          <Text style={styles.body}>
            Melchizedek Priesthood ordinations skip the SP Board and go directly to HC Approval after creation. They then follow the same HC stages (Sustain → Ordain → Record → Complete).
          </Text>
        </Section>

        <Section title="SP Board">
          <Text style={styles.body}>
            Visible to Stake Presidency members, Stake Clerk, and Stake Executive Secretary. Displays callings in Ideas, For Approval, and Stake Approved columns. Use the type filter (All / Ward / Stake / MP) to narrow the view.
          </Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>
            To advance a calling, open the card and tap the advance button. Presidency approval checkboxes must be completed before advancing from For Approval.
          </Text>
        </Section>

        <Section title="HC Board">
          <Text style={styles.body}>
            Visible to all users. Displays callings from HC Approval through Record. Use the ward filter and assignee filter to find your tasks quickly.
          </Text>
          <Text style={[styles.body, { marginTop: Spacing.xs }]}>
            When filtering by your name, the board shows both cards assigned to you (extend, sustain, set apart, record) and HC Approval cards where you haven't yet checked your approval.
          </Text>
        </Section>

        <Section title="Slack Notifications">
          <Text style={styles.body}>
            Admins can configure Slack webhooks in Settings → Slack Notifications. Separate webhooks can be set for SP Board updates, HC Board updates, rejections, and user access requests. Each Slack message includes who made the change and a link to the card.
          </Text>
        </Section>

        <Section title="Frequently Asked Questions">
          <Item
            label="Why can't I advance a calling?"
            description="Callings require specific approvals before advancing. For 'For Approval' stage, the Stake President must approve, or all three presidency members must approve. For 'HC Approval', at least 50% of active HC members must approve."
          />
          <Item
            label="How do I add a user?"
            description="Users self-register at the login screen. Admins (Stake President, Stake Clerk, Executive Secretary) then approve them in Settings → Manage Users."
          />
          <Item
            label="How do I add Slack notifications?"
            description="Go to Settings → Slack Notifications. Paste the Incoming Webhook URL from your Slack workspace for each notification type you want to enable."
          />
          <Item
            label="Can I undo a stage change?"
            description="Stake Clerk, Stake Executive Secretary, and Stake Presidency can move a calling back one stage using the 'Move Back' button on the card detail screen."
          />
          <Item
            label="How do I delete a calling?"
            description="Stake Clerk, Stake Executive Secretary, and Stake Presidency can delete callings. Open the card detail and tap the Delete button at the bottom."
          />
        </Section>

        <Text style={styles.footer}>Magnify · Stake Callings Workflow</Text>
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
