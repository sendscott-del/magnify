import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { KIND, tint } from '../../lib/dashboard';
import {
  ReminderSent, ScheduleMeeting, ScheduleWeek, Timeline, TimelineEvent,
  fmtClock, formatLabel, formatSundayLong, toMinutes,
} from '../../lib/schedule';
import { Button } from '../ui/Button';
import { FlagPill, cardBase } from './primitives';

type T = (key: TranslationKey) => string;

/** The accent on the card is the recommend teal from the KIND catalog. */
const ACCENT = KIND.recommend.color;

export type SundayLayout = 'president' | 'counselor' | 'clerk' | 'member';

interface Props {
  layout: SundayLayout;
  sundayISO: string;
  week: ScheduleWeek | null;
  /** Meetings already narrowed to the viewer's bodies. */
  meetings: ScheduleMeeting[];
  timeline: Timeline;
  companion?: { name: string; reason?: string | null } | null;
  /** True when the viewer IS the companion this week. */
  isCompanion?: boolean;
  /** HC/SC: the viewer's own interview date, if scheduled this Sunday. */
  ownInterviewDate?: string | null;
  reminders: ReminderSent[];
  canPostSlack: boolean;
  canSendText: boolean;
  canEdit: boolean;
  onPostSlack: () => void;
  onSendText: () => void;
  onEdit: () => void;
  language: 'en' | 'es';
  t: T;
}

/**
 * This Sunday — the zone above the tiles from Friday to Sunday.
 *
 * Built from app data only. The card names a conflict and the fix in words;
 * it never reorders the day. Sent reminders stay visible as disabled buttons
 * rather than disappearing, because "did it go out" is the question.
 */
export function ThisSundayCard({
  layout, sundayISO, week, meetings, timeline, companion, isCompanion, ownInterviewDate,
  reminders, canPostSlack, canSendText, canEdit, onPostSlack, onSendText, onEdit, language, t,
}: Props) {
  const eyebrow = layout === 'president' ? t('sunday.eyebrow')
    : layout === 'counselor' ? t('sunday.eyebrowYourDay')
    : layout === 'clerk' ? t('sunday.eyebrowMeetings')
    : t('sunday.eyebrowYours');

  const slackSent = reminders.find(r => r.channel === 'slack');
  const textSent = reminders.find(r => r.channel === 'tidings');
  const conflictCount = timeline.conflicts.length;
  const nonMeetingKind = week && week.kind !== 'meetings';

  const kindLine = week
    ? nonMeetingKind
      ? [t(`schedule.kind.${week.kind}` as TranslationKey), week.holiday_label].filter(Boolean).join(' · ')
      : null
    : t('sunday.noSchedule');

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
          <Text style={styles.date}>{formatSundayLong(sundayISO, language)}</Text>
        </View>
        {layout === 'clerk' && <FlagPill label={t('sunday.meetingsOnly')} tone="neutral" />}
        {layout !== 'clerk' && conflictCount > 0 && (
          <FlagPill label={`${conflictCount} ${conflictCount === 1 ? t('sunday.conflict') : t('sunday.conflicts')}`} tone="late" />
        )}
      </View>

      {!!kindLine && <Text style={styles.kindLine}>{kindLine}</Text>}

      {layout === 'clerk' ? (
        <MeetingsList meetings={meetings} t={t} />
      ) : layout === 'member' ? (
        <MemberView
          meetings={meetings}
          isCompanion={!!isCompanion}
          ownInterviewDate={ownInterviewDate ?? null}
          t={t}
          language={language}
        />
      ) : (
        <TimelineView timeline={timeline} t={t} />
      )}

      {layout === 'clerk' && (
        <Text style={styles.hint}>{t('sunday.clerkHint')}</Text>
      )}

      {layout === 'president' && companion && (
        <View style={styles.companionRow}>
          <View style={[styles.companionChip, { backgroundColor: tint(KIND.assignment.color) }]}>
            <Ionicons name={KIND.assignment.icon} size={15} color={KIND.assignment.color} />
          </View>
          <Text style={styles.companionText} numberOfLines={2}>
            {t('sunday.companion')}: {companion.name}{companion.reason ? ` · ${companion.reason}` : ''}
          </Text>
        </View>
      )}

      {(canPostSlack || canSendText || canEdit) && (
        <View style={styles.actions}>
          {canPostSlack && (
            slackSent ? (
              <SentState label={`${t('sunday.slackPosted')} ${clockOf(slackSent.sent_at)}`} />
            ) : (
              <Button title={t('sunday.postSlack')} onPress={onPostSlack} variant="primary" fullWidth style={styles.btn} />
            )
          )}
          <View style={styles.actionRow}>
            {canSendText && (
              textSent ? (
                <SentState
                  label={`${t('sunday.textSentTo')} ${textSent.recipient_count ?? '?'} · ${clockOf(textSent.sent_at)}`}
                  half
                />
              ) : (
                <Button title={t('sunday.sendText')} onPress={onSendText} variant="outline" style={styles.halfBtn} />
              )
            )}
            {canEdit && (
              <Button title={t('sunday.editSunday')} onPress={onEdit} variant="secondary" style={styles.halfBtn} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function clockOf(iso: string): string {
  const d = new Date(iso);
  return fmtClock(d.getHours() * 60 + d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM');
}

function SentState({ label, half }: { label: string; half?: boolean }) {
  return (
    <View style={[styles.sent, half && styles.half]} pointerEvents="none">
      <Ionicons name="checkmark" size={16} color={Colors.gray[600]} />
      <Text style={styles.sentText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function TimelineView({ timeline, t }: { timeline: Timeline; t: T }) {
  if (!timeline.events.length) {
    return <Text style={styles.empty}>{t('sunday.nothingOnYourDay')}</Text>;
  }
  return (
    <View style={styles.timeline}>
      {timeline.events.map((ev, i) => (
        <React.Fragment key={`${ev.kind}-${ev.start}-${i}`}>
          {ev.kind === 'drive' ? <DriveRow ev={ev} /> : <EventRow ev={ev} />}
          {!!ev.conflict && (
            <View style={styles.conflict}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.conflictText}>{ev.conflict}</Text>
            </View>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function EventRow({ ev }: { ev: TimelineEvent }) {
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{fmtClock(ev.start)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{ev.title}</Text>
        {!!ev.meta && <Text style={styles.meta}>{ev.meta}</Text>}
      </View>
    </View>
  );
}

function DriveRow({ ev }: { ev: TimelineEvent }) {
  return (
    <View style={styles.drive}>
      <View style={styles.driveIcon}>
        <Ionicons name="car-outline" size={18} color={Colors.gray[400]} />
      </View>
      <Text style={styles.driveText}>{ev.title} · {ev.meta}</Text>
    </View>
  );
}

function MeetingsList({ meetings, t }: { meetings: ScheduleMeeting[]; t: T }) {
  if (!meetings.length) return <Text style={styles.empty}>{t('sunday.noMeetings')}</Text>;
  return (
    <View style={styles.timeline}>
      {[...meetings].sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at)).map(m => (
        <View style={styles.row} key={m.id}>
          <Text style={styles.time}>{fmtClock(toMinutes(m.starts_at))}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t(`schedule.body.${m.body}` as TranslationKey)}</Text>
            <Text style={styles.meta}>
              {`${fmtClock(toMinutes(m.starts_at))}–${fmtClock(toMinutes(m.ends_at))} · ${formatLabel(m.format, t)}${m.label ? ` · ${m.label}` : ''}`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MemberView({
  meetings, isCompanion, ownInterviewDate, t, language,
}: { meetings: ScheduleMeeting[]; isCompanion: boolean; ownInterviewDate: string | null; t: T; language: 'en' | 'es' }) {
  const lines: string[] = [];
  if (isCompanion) lines.push(t('sunday.youAccompany'));
  for (const m of [...meetings].sort((a, b) => toMinutes(a.starts_at) - toMinutes(b.starts_at))) {
    lines.push(`${t(`schedule.body.${m.body}` as TranslationKey)} ${fmtClock(toMinutes(m.starts_at))}–${fmtClock(toMinutes(m.ends_at))}, ${formatLabel(m.format, t)}.`);
  }
  if (ownInterviewDate) {
    lines.push(`${t('sunday.yourInterview')}: ${formatSundayLong(ownInterviewDate, language)} — ${t('sunday.timeToBeSet')}`);
  }
  if (!lines.length) return <Text style={styles.empty}>{t('sunday.nothingForYou')}</Text>;
  return (
    <View style={{ gap: 6 }}>
      {lines.map((l, i) => <Text key={i} style={styles.memberLine}>{l}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardBase,
    borderTopWidth: 3,
    borderTopColor: ACCENT,
    padding: 14,
    gap: 12,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: ACCENT },
  date: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900], marginTop: 2 },
  kindLine: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[600] },
  timeline: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  time: { width: 48, fontSize: FontSize.sm, fontWeight: '800', color: Colors.gray[700], paddingTop: 1 },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  drive: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.gray[50],
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.gray[200],
    borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 10,
  },
  driveIcon: { width: 38, alignItems: 'center' },
  driveText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500] },
  conflict: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: 10,
  },
  conflictText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#7F1D1D' },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500] },
  empty: { fontSize: FontSize.sm, color: Colors.gray[500] },
  memberLine: { fontSize: FontSize.sm, color: Colors.gray[800], lineHeight: 19 },
  companionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: Colors.gray[100], paddingTop: 10,
  },
  companionChip: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  companionText: { flex: 1, fontSize: 12, color: Colors.gray[600] },
  actions: { gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 44 },
  half: { flex: 1 },
  halfBtn: { minHeight: 44, flex: 1 },
  sent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, borderRadius: Radius.md, backgroundColor: Colors.gray[100], opacity: 0.5,
    paddingHorizontal: 10,
  },
  sentText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700] },
});
