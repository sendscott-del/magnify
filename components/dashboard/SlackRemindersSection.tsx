import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { SlackReminder, fmtClock } from '../../lib/schedule';
import { Button } from '../ui/Button';
import { cardBase } from './primitives';

type T = (key: TranslationKey) => string;

/**
 * Slack reminders — their own section, with the words on screen.
 *
 * Scott, 2026-09-27: "Put 'post slack reminders' in its own section. And on or
 * near that button it needs to show the text that will go into slack. When I
 * push that button I want to know what I am posting."
 *
 * Until then the button sat inside This Sunday and the text was one sheet
 * away, so pressing Post meant trusting a message you had not read. Every post
 * is now printed in full, labelled with its channel, directly above the
 * button. The button still goes through the existing confirm sheet: that is
 * the tested send path — it logs to magnify_reminders_sent, refuses a second
 * send for the same Sunday, and names any channel with no webhook, which is
 * skipped rather than silently lost.
 */
export function SlackRemindersSection({
  posts, sentAt, onPost, t,
}: {
  posts: SlackReminder[];
  /** ISO time the reminders went out this Sunday, if they have. */
  sentAt: string | null;
  onPost: () => void;
  t: T;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
        <Text style={styles.title}>{t('slack.section.title')}</Text>
      </View>

      {posts.length === 0 ? (
        <Text style={styles.empty}>{t('slack.section.nothing')}</Text>
      ) : (
        <>
          <Text style={styles.lead}>{t('slack.section.lead')}</Text>
          {posts.map(p => (
            <View key={p.eventType} style={styles.post}>
              <Text style={styles.channel}>{p.channelLabel}</Text>
              {/* The exact body that will be posted — selectable so it can be
                  copied, and never truncated: the point is to read all of it. */}
              <Text style={styles.body} selectable>{p.body}</Text>
            </View>
          ))}
        </>
      )}

      {sentAt ? (
        <View style={styles.sent}>
          <Ionicons name="checkmark" size={16} color={Colors.gray[600]} />
          <Text style={styles.sentText}>{t('sunday.slackPosted')} {clockOf(sentAt)}</Text>
        </View>
      ) : posts.length > 0 ? (
        <Button title={t('sunday.postSlack')} onPress={onPost} variant="primary" fullWidth style={styles.btn} />
      ) : null}
    </View>
  );
}

function clockOf(iso: string): string {
  const d = new Date(iso);
  return fmtClock(d.getHours() * 60 + d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM');
}

const styles = StyleSheet.create({
  card: { ...cardBase, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.gray[900] },
  lead: { fontSize: FontSize.sm, color: Colors.gray[500] },
  empty: { fontSize: FontSize.sm, color: Colors.gray[500] },
  post: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1, borderColor: Colors.gray[200],
    borderRadius: Radius.md, padding: 12, gap: 6,
  },
  channel: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 0.3 },
  body: { fontSize: FontSize.sm, lineHeight: 20, color: Colors.gray[800] },
  btn: { minHeight: 44, marginTop: 2 },
  sent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, borderRadius: Radius.md, backgroundColor: Colors.gray[100],
  },
  sentText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700] },
});
