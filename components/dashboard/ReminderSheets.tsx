import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeModal } from '../ui/SafeModal';
import { Button } from '../ui/Button';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { SlackReminder, TextReminder } from '../../lib/schedule';
import { Callout } from './primitives';

type T = (key: TranslationKey) => string;

/**
 * Reminder confirmations. Both show the exact text and the recipient count
 * before anything sends, and both refuse a second send for the same week —
 * the caller passes `alreadySent` from magnify_reminders_sent.
 */

function SheetShell({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.wrap}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <ScrollView style={styles.scroll} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </SafeModal>
  );
}

interface SlackProps {
  visible: boolean;
  sundayLabel: string;
  reminders: SlackReminder[];
  /** event_type → webhook url; a missing key means that channel is not configured. */
  webhooks: Record<string, string>;
  alreadySent: boolean;
  posting: boolean;
  onPost: () => void;
  onClose: () => void;
  t: T;
}

export function SlackReminderSheet({
  visible, sundayLabel, reminders, webhooks, alreadySent, posting, onPost, onClose, t,
}: SlackProps) {
  const ready = reminders.filter(r => webhooks[r.eventType]);
  const missing = reminders.filter(r => !webhooks[r.eventType]);
  const count = ready.length;
  return (
    <SheetShell visible={visible} onClose={onClose}>
      <View>
        <Text style={styles.title}>{t('sunday.postSlack')}</Text>
        <Text style={styles.sub}>
          {count === 1 ? t('sunday.slackIntroOne') : t('sunday.slackIntro').replace('{n}', String(count))} {sundayLabel}. {t('sunday.readBefore')}
        </Text>
      </View>

      {reminders.length === 0 && <Text style={styles.sub}>{t('sunday.noSlackMeetings')}</Text>}

      {reminders.map(r => (
        <View key={r.eventType} style={[styles.block, !webhooks[r.eventType] && styles.blockMuted]}>
          <Text style={styles.channel}>{r.channelLabel.toUpperCase()}</Text>
          <Text style={styles.body}>{r.body}</Text>
          {!webhooks[r.eventType] && (
            <Text style={styles.missing}>{t('sunday.noWebhook')}</Text>
          )}
        </View>
      ))}

      <Callout icon={alreadySent ? 'checkmark-circle-outline' : 'warning-outline'} tone={alreadySent ? 'info' : 'warning'}>
        {alreadySent ? t('sunday.slackAlreadyPosted') : t('sunday.slackTwiceRefused')}
      </Callout>

      <Button
        title={count === 1 ? t('sunday.postOne') : t('sunday.postBoth').replace('{n}', String(count))}
        onPress={onPost}
        variant="primary"
        fullWidth
        disabled={alreadySent || count === 0}
        loading={posting}
        style={styles.cta}
      />
      {missing.length > 0 && count > 0 && (
        <Text style={styles.sub}>{t('sunday.postOnlyConfigured')}</Text>
      )}
      <Button title={t('dash.edit.cancel')} onPress={onClose} variant="ghost" fullWidth />
    </SheetShell>
  );
}

interface TextProps {
  visible: boolean;
  sundayLabel: string;
  reminder: TextReminder | null;
  /** Unique recipients across the lists, from the edge function preview. null = still loading. */
  recipientCount: number | null;
  listSummary: string;
  alreadySent: boolean;
  sending: boolean;
  error?: string | null;
  onSend: () => void;
  onClose: () => void;
  t: T;
}

export function TextReminderSheet({
  visible, sundayLabel, reminder, recipientCount, listSummary, alreadySent, sending, error, onSend, onClose, t,
}: TextProps) {
  return (
    <SheetShell visible={visible} onClose={onClose}>
      <View>
        <Text style={styles.title}>{t('sunday.sendText')}</Text>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countNum}>{recipientCount === null ? '…' : recipientCount}</Text>
        <Text style={styles.countUnit}>{t('sunday.uniqueRecipients')}</Text>
      </View>
      <Text style={styles.sub}>{listSummary} {sundayLabel}. {t('sunday.viaTidings')}</Text>

      {reminder && (
        <View style={styles.block}>
          <Text style={styles.body}>{reminder.body}</Text>
        </View>
      )}

      {!!error && <Callout icon="alert-circle-outline" tone="warning">{error}</Callout>}
      {alreadySent && <Callout icon="checkmark-circle-outline" tone="info">{t('sunday.textAlreadySent')}</Callout>}

      <Button
        title={`${t('sunday.sendTo')} ${recipientCount ?? '…'} ${t('sunday.recipients')}`}
        onPress={onSend}
        variant="primary"
        fullWidth
        disabled={alreadySent || !reminder || recipientCount === null || recipientCount === 0}
        loading={sending}
        style={styles.cta}
      />
      <Button title={t('dash.edit.cancel')} onPress={onClose} variant="ghost" fullWidth />
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  wrap: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingTop: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 }),
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.gray[300], marginBottom: 12 },
  scroll: { flexGrow: 0 },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  sub: { fontSize: FontSize.sm, color: Colors.gray[600], marginTop: 4, lineHeight: 19 },
  block: {
    backgroundColor: Colors.gray[50], borderWidth: 1, borderColor: Colors.gray[200],
    borderRadius: Radius.md, padding: 12, gap: 6,
  },
  blockMuted: { opacity: 0.6 },
  channel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.gray[600], letterSpacing: 0.5 },
  body: { fontSize: FontSize.sm, lineHeight: 19, color: Colors.gray[900] },
  missing: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  countNum: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.gray[900], letterSpacing: -1 },
  countUnit: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500] },
  cta: { minHeight: 48 },
});
