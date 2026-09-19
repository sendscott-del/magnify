import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import { cardBase, CalmEmpty } from '../../components/dashboard/primitives';
import { formatMonthDay, todayISO } from '../../lib/dashboard';
import { Seat, SEATS, bodiesForRole, comingSundayISO, fmtClock, meetingTitle, quarterOf, toMinutes } from '../../lib/schedule';
import { YearRow, loadEvents, loadYear } from '../../lib/scheduleData';
import { CalendarEvent, localDateISO, localMinutes } from '../../lib/schedule';
import { WardRef } from '../../lib/useDashboardData';
import { supabase } from '../../lib/supabase';
import { useDemoMode, isReviewDemoUser } from '../../context/DemoModeContext';
import { DEMO_SUNDAY } from '../../lib/demoSchedule';

/**
 * Calendar — the year of Sundays, quarter by quarter.
 *
 * Everyone sees the meetings they are part of; the presidency and clerks
 * also see the building assignments and can open a Sunday to edit it. A
 * high councilor or stake council member sees a read-only list filtered to
 * the meetings he attends and nothing about who visits which ward.
 */
export function CalendarScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { profile, isPresidency, isClerk } = useAuth();
  const { demoMode } = useDemoMode();
  const { t, language } = useLanguage();
  const isDemo = demoMode || isReviewDemoUser(profile?.email) || profile?.is_demo === true;
  const canEdit = (isPresidency || isClerk) && !isDemo;
  const showSeats = isPresidency || isClerk;
  const role = profile?.role ?? '';
  const bodiesFor = useMemo(() => bodiesForRole(role), [role]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<YearRow[]>([]);
  const [wards, setWards] = useState<WardRef[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Open on this week, not January: measure the coming Sunday's row and
  // scroll to it once the list has laid out. Three offsets add up because the
  // row sits inside a card inside a quarter block.
  const scrollRef = useRef<ScrollView>(null);
  // Children lay out before parents, so the row reports first; wait until all
  // three offsets are known before scrolling (a legitimate 0 must not count as
  // "not yet measured", hence nulls).
  const offsets = useRef<{ quarter: number | null; card: number | null; row: number | null }>({ quarter: null, card: null, row: null });
  const scrolled = useRef(false);
  function maybeScroll() {
    if (scrolled.current) return;
    const { quarter, card, row } = offsets.current;
    if (quarter === null || card === null || row === null) return;
    scrolled.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, quarter + card + row - 12), animated: false }));
  }
  useEffect(() => { scrolled.current = false; offsets.current = { quarter: null, card: null, row: null }; }, [year, rows]);

  const load = useCallback(async () => {
    if (isDemo) {
      const b = DEMO_SUNDAY.bundle(comingSundayISO());
      setRows(b.week ? [{ week: b.week, meetings: b.meetings, assignments: b.assignments }] : []);
      setWards(DEMO_SUNDAY.reference.wards);
      setLoading(false);
      return;
    }
    const [r, w, ev] = await Promise.all([
      loadYear(year),
      supabase.from('wards').select('id, name, abbreviation').order('sort_order'),
      // Presidency + clerks only; RLS returns nothing for anyone else.
      showSeats ? loadEvents(new Date(`${year}-01-01T00:00:00`).toISOString(), new Date(`${year + 1}-01-01T00:00:00`).toISOString()) : Promise.resolve([] as CalendarEvent[]),
    ]);
    setRows(r);
    setWards((w.data ?? []) as WardRef[]);
    setEvents(ev);
    setLoading(false);
  }, [year, isDemo, showSeats]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const abbrev = (id: string) => wards.find(w => w.id === id)?.abbreviation ?? '';
  const today = todayISO();
  const coming = comingSundayISO();

  // Google Calendar events grouped under the Sunday that ends their week
  // (Monday through Sunday), so a Tuesday meeting shows under the coming Sunday.
  const eventsByWeek = useMemo(() => {
    const out: Record<string, CalendarEvent[]> = {};
    const sundays = rows.map(r => r.week.sunday_on).sort();
    for (const ev of events) {
      if (ev.all_day) continue;
      const day = localDateISO(ev.starts_at);
      const sunday = sundays.find(s => s >= day);
      if (!sunday) continue;
      const d = new Date(sunday + 'T00:00:00'); d.setDate(d.getDate() - 6);
      const weekStart = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
      if (day < weekStart) continue;
      (out[sunday] ??= []).push(ev);
    }
    return out;
  }, [events, rows]);

  const quarters = useMemo(() => {
    const out: Record<number, YearRow[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const r of rows) out[quarterOf(r.week.sunday_on)].push(r);
    return out;
  }, [rows]);

  function openSunday(sunday: string) {
    if (!canEdit) return;
    nav.navigate('ScheduleEdit', { sunday });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, !isDesktopWeb && { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('nav.calendar')}</Text>
          <Text style={styles.headerSub}>{t('schedule.title')}</Text>
        </View>
        <View style={styles.yearRow}>
          <TouchableOpacity onPress={() => setYear(y => y - 1)} hitSlop={8}><Ionicons name="chevron-back" size={20} color={Colors.primary} /></TouchableOpacity>
          <Text style={styles.year}>{year}</Text>
          <TouchableOpacity onPress={() => setYear(y => y + 1)} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={Colors.primary} /></TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && (
            <CalmEmpty title={t('schedule.emptyTitle')} sub={canEdit ? t('schedule.emptySubAdmin') : t('schedule.emptySub')} icon="calendar-outline" tone="neutral" />
          )}
          {[1, 2, 3, 4].map(q => quarters[q].length > 0 && (
            <View
              key={q}
              style={styles.quarter}
              onLayout={e => { if (quarters[q].some(r => r.week.sunday_on === coming)) { offsets.current.quarter = e.nativeEvent.layout.y; maybeScroll(); } }}
            >
              <Text style={styles.quarterTitle}>Q{q}</Text>
              <View
                style={styles.listCard}
                onLayout={e => { if (quarters[q].some(r => r.week.sunday_on === coming)) { offsets.current.card = e.nativeEvent.layout.y; maybeScroll(); } }}
              >
                {quarters[q].map((r, i) => {
                  const past = r.week.sunday_on < today;
                  const isComing = r.week.sunday_on === coming;
                  const meetings = r.meetings.filter(m => bodiesFor(m.body)).sort((a, b) => (a.day_offset ?? 0) - (b.day_offset ?? 0) || toMinutes(a.starts_at) - toMinutes(b.starts_at));
                  const kindLabel = r.week.kind !== 'meetings'
                    ? [t(`schedule.kind.${r.week.kind}` as TranslationKey), r.week.holiday_label].filter(Boolean).join(' · ')
                    : null;
                  return (
                    <TouchableOpacity
                      key={r.week.id}
                      style={[styles.row, i > 0 && styles.rowDivider, past && styles.rowPast, isComing && styles.rowComing]}
                      onPress={() => openSunday(r.week.sunday_on)}
                      activeOpacity={canEdit ? 0.8 : 1}
                      disabled={!canEdit}
                      onLayout={isComing ? e => { offsets.current.row = e.nativeEvent.layout.y; maybeScroll(); } : undefined}
                    >
                      <View style={styles.dateCol}>
                        <Text style={styles.dateText}>{formatMonthDay(r.week.sunday_on, language)}</Text>
                        {isComing && <Text style={styles.comingTag}>{t('schedule.thisSunday').toUpperCase()}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        {!!kindLabel && <Text style={styles.kind}>{kindLabel}</Text>}
                        {meetings.map(m => (
                          <Text key={m.id} style={styles.meeting} numberOfLines={1}>
                            {(m.day_offset ?? 0) === -1 ? `${t('schedule.sat')} · ` : ''}{meetingTitle(m, t)} · {fmtClock(toMinutes(m.starts_at))}–{fmtClock(toMinutes(m.ends_at))}{m.format === 'zoom' ? ` · ${t('schedule.format.zoom')}` : ''}
                          </Text>
                        ))}
                        {!kindLabel && meetings.length === 0 && !(eventsByWeek[r.week.sunday_on]?.length) && <Text style={styles.meetingMuted}>{t('schedule.noMeetingsListed')}</Text>}
                        {(eventsByWeek[r.week.sunday_on] ?? []).map(ev => (
                          <Text key={ev.id} style={styles.event} numberOfLines={1}>
                            {formatEventDay(ev.starts_at, r.week.sunday_on, language)} · {ev.title} · {fmtClock(localMinutes(ev.starts_at))}{localMinutes(ev.starts_at) < 720 ? ' AM' : ' PM'}
                          </Text>
                        ))}
                        {showSeats && (
                          <View style={styles.seatRow}>
                            {SEATS.map(seat => {
                              const ids = r.assignments.filter(a => a.seat === (seat as Seat)).map(a => a.ward_id);
                              if (!ids.length) return null;
                              return (
                                <View key={seat} style={styles.seatChip}>
                                  <Text style={styles.seatKey}>{seat}</Text>
                                  <Text style={styles.seatVal}>{ids.map(abbrev).join(', ')}</Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                      {canEdit && <Ionicons name="chevron-forward" size={18} color={Colors.gray[300]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {canEdit && (
            <TouchableOpacity style={styles.addSunday} onPress={() => nav.navigate('ScheduleEdit', { sunday: nextUnscheduledSunday(rows, coming) })} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addText}>{t('schedule.addSunday')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/** 'Tue 9/29' for a weekday event, 'Sun' for one on the Sunday itself. */
function formatEventDay(iso: string, sunday: string, language: 'en' | 'es'): string {
  const day = localDateISO(iso);
  const d = new Date(iso);
  const wd = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' });
  return day === sunday ? wd : `${wd} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** The first Sunday from the coming one that has no row yet. */
function nextUnscheduledSunday(rows: YearRow[], from: string): string {
  const have = new Set(rows.map(r => r.week.sunday_on));
  const d = new Date(from + 'T00:00:00');
  for (let i = 0; i < 60; i++) {
    const iso = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
    if (!have.has(iso)) return iso;
    d.setDate(d.getDate() + 7);
  }
  return from;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 12,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, letterSpacing: -0.4 },
  headerSub: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  year: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  scroll: { padding: Spacing.md, gap: 16, paddingBottom: 40 },
  quarter: { gap: 8 },
  quarterTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gray[400], letterSpacing: 0.5 },
  listCard: { ...cardBase },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.gray[100] },
  rowPast: { opacity: 0.55 },
  rowComing: { backgroundColor: Colors.primaryFade },
  dateCol: { width: 64 },
  dateText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.gray[800] },
  comingTag: { fontSize: 9, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5, marginTop: 2 },
  kind: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[600] },
  meeting: { fontSize: FontSize.sm, color: Colors.gray[900] },
  meetingMuted: { fontSize: FontSize.sm, color: Colors.gray[400] },
  event: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 1 },
  seatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  seatChip: { flexDirection: 'row', gap: 4, backgroundColor: Colors.gray[100], borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  seatKey: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  seatVal: { fontSize: 10, fontWeight: '600', color: Colors.gray[700] },
  addSunday: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  addText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
});
