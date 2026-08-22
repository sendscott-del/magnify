import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Modal, FlatList, Platform, Share, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useDemoMode, isReviewDemoUser } from '../../context/DemoModeContext';
import { useActionCounts } from '../../context/ActionCountsContext';
import { getDemoHCCallings } from '../../lib/demoCallings';
import { Calling, CallingType, Ward } from '../../lib/database.types';
import { KanbanColumn } from '../../components/kanban/KanbanColumn';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { EnableNotificationsBanner } from '../../components/EnableNotificationsBanner';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import { notifyHcApprovalReminder } from '../../lib/slack';

export function HCKanbanScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  async function sendHcReminder() {
    if (reminderBusy || reminderSent) return;
    setReminderBusy(true);
    const count = callings.filter(c => c.stage === 'hc_approval' && !c.rejected).length;
    await notifyHcApprovalReminder(count, profile?.full_name ?? 'Stake Presidency');
    setReminderBusy(false);
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 60000);
  }
  const isDesktopWeb = useIsDesktopWeb();

  const HC_COLUMNS = [
    { stages: ['hc_approval'], label: t('stage.hc_approval'), color: Colors.stage.hc_approval },
    { stages: ['issue_calling', 'ordained'], label: t('stage.issue_calling'), color: Colors.stage.issue_calling },
    { stages: ['sustain'], label: t('stage.sustain'), color: Colors.stage.sustain },
    { stages: ['set_apart'], label: t('stage.set_apart'), color: Colors.stage.set_apart },
    { stages: ['record'], label: t('stage.record'), color: Colors.stage.record },
  ];

  const TYPE_FILTERS: { label: string; value: CallingType | 'all' }[] = [
    { label: t('hcBoard.filterAll'), value: 'all' },
    { label: t('type.ward_calling_short'), value: 'ward_calling' },
    { label: t('type.stake_calling_short'), value: 'stake_calling' },
    { label: t('type.mp_ordination_short'), value: 'mp_ordination' },
  ];
  const [callings, setCallings] = useState<Calling[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [rawSpMembers, setRawSpMembers] = useState<{ name: string; role: string }[]>([]);
  const [rawHcMembers, setRawHcMembers] = useState<{ name: string; user_id: string | null }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hcApprovalMap, setHcApprovalMap] = useState<Record<string, boolean>>({});
  const [hcMemberIdMap, setHcMemberIdMap] = useState<Record<string, string>>({});
  // hc_member_id -> Set of ward_ids that HC covers. Drives "Just mine" on Sustain.
  const [hcWardCoverage, setHcWardCoverage] = useState<Record<string, Set<string>>>({});
  // calling_id -> Set of ward_ids whose ward_sustainings row is sustained=true.
  // Stake callings in sustain stage need sustaining in every ward NOT in this set.
  const [sustainedWardMap, setSustainedWardMap] = useState<Record<string, Set<string>>>({});

  const [typeFilter, setTypeFilter] = useState<CallingType | 'all'>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const [showWardFilter, setShowWardFilter] = useState(false);
  const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptWard, setScriptWard] = useState<Ward | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  // Compute translated assignee options reactively (updates when language changes)
  const assigneeOptions = useMemo(() => {
    const spLabelMap: Record<string, string> = {
      stake_president: t('role.stake_president'),
      first_counselor: t('hcBoard.sp1stCounselor'),
      second_counselor: t('hcBoard.sp2ndCounselor'),
      stake_clerk: t('role.stake_clerk'),
      exec_secretary: t('role.exec_secretary'),
    };
    const spOptions = rawSpMembers.map(m => ({ name: m.name, subtitle: spLabelMap[m.role] ?? m.role }));
    const hcOptions = rawHcMembers.map(m => ({ name: m.name, subtitle: t('role.high_councilor') }));
    return [...spOptions, ...hcOptions];
  }, [rawSpMembers, rawHcMembers, t]);

  // "Just mine" toggle: only meaningful when the signed-in user appears in the assignee list.
  // Prefer a hard user_id link from the roster; fall back to exact full-name match.
  const myAssigneeName = useMemo(() => {
    const linked = profile?.id ? rawHcMembers.find(m => m.user_id && m.user_id === profile.id) : undefined;
    if (linked) return linked.name;
    const me = profile?.full_name;
    if (!me) return null;
    return assigneeOptions.some(o => o.name === me) ? me : null;
  }, [profile?.id, profile?.full_name, rawHcMembers, assigneeOptions]);
  const showingJustMine = myAssigneeName !== null && assigneeFilter === myAssigneeName;

  const { demoMode } = useDemoMode();
  const { refresh: refreshActionCounts } = useActionCounts();

  const fetchData = useCallback(async () => {
    if (demoMode || isReviewDemoUser(profile?.email)) {
      // Demo: fixture HC-stage callings + a couple of fake HC members so
      // the board has rows to render. Approval map left empty in demo.
      setCallings(getDemoHCCallings());
      setWards([
        { id: 'demo-ward-1', name: 'Hyde Park 1st', abbreviation: 'HP1' },
        { id: 'demo-ward-2', name: 'Hyde Park 2nd', abbreviation: 'HP2' },
        { id: 'demo-ward-3', name: 'Midway',         abbreviation: 'MW'  },
      ] as unknown as Ward[]);
      setRawSpMembers([
        { name: 'President Williams', role: 'stake_president' },
        { name: 'Brother Andersen',   role: 'first_counselor' },
        { name: 'Brother Park',       role: 'second_counselor' },
      ]);
      setRawHcMembers([
        { name: 'Brother Reyes', user_id: null },
        { name: 'Brother Tanaka', user_id: null },
        { name: 'Brother Lopez', user_id: null },
        { name: 'Brother Kim', user_id: null },
      ]);
      setHcMemberIdMap({});
      setHcApprovalMap({});
      setHcWardCoverage({});
      setSustainedWardMap({});
      setViewedIds(new Set());
      return;
    }
    const [callingsRes, wardsRes, spMembersRes, hcMembersRes, hcApprovalsRes, hcWardsRes, wardSustRes] = await Promise.all([
      supabase
        .from('callings')
        .select('*, wards!callings_ward_id_fkey(id,name,abbreviation)')
        .in('stage', ['hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record'])
        .eq('rejected', false)
        .order('created_at', { ascending: false }),
      supabase.from('wards').select('*').order('name'),
      supabase.from('sp_members').select('id,name,role').eq('active', true).order('sort_order'),
      supabase.from('high_council_members').select('id,name,sort_order,user_id').eq('active', true).order('sort_order'),
      supabase.from('hc_approvals').select('calling_id,hc_member_id,approved'),
      supabase.from('hc_member_wards').select('hc_member_id, ward_id'),
      supabase.from('ward_sustainings').select('calling_id, ward_id, sustained').eq('sustained', true),
    ]);
    setCallings((callingsRes.data as Calling[]) ?? []);
    setWards((wardsRes.data as Ward[]) ?? []);
    setRawSpMembers((spMembersRes.data ?? []).map((m: any) => ({ name: m.name, role: m.role })));
    setRawHcMembers((hcMembersRes.data ?? []).map((m: any) => ({ name: m.name, user_id: m.user_id ?? null })));

    // Build HC member name→id map
    const nameToId: Record<string, string> = {};
    (hcMembersRes.data ?? []).forEach((m: any) => { nameToId[m.name] = m.id; });
    setHcMemberIdMap(nameToId);

    // Build approval map: "callingId:hcMemberId" → approved boolean
    const approvalMap: Record<string, boolean> = {};
    (hcApprovalsRes.data ?? []).forEach((a: any) => {
      approvalMap[`${a.calling_id}:${a.hc_member_id}`] = a.approved;
    });
    setHcApprovalMap(approvalMap);

    const coverage: Record<string, Set<string>> = {};
    ((hcWardsRes.data ?? []) as { hc_member_id: string; ward_id: string }[]).forEach((row) => {
      if (!coverage[row.hc_member_id]) coverage[row.hc_member_id] = new Set();
      coverage[row.hc_member_id].add(row.ward_id);
    });
    setHcWardCoverage(coverage);

    const sustainedMap: Record<string, Set<string>> = {};
    ((wardSustRes.data ?? []) as { calling_id: string; ward_id: string }[]).forEach((row) => {
      if (!sustainedMap[row.calling_id]) sustainedMap[row.calling_id] = new Set();
      sustainedMap[row.calling_id].add(row.ward_id);
    });
    setSustainedWardMap(sustainedMap);

    // Fetch which callings this user has viewed
    if (profile?.id) {
      const { data: views } = await supabase
        .from('calling_views')
        .select('calling_id')
        .eq('user_id', profile.id);
      if (views) {
        setViewedIds(new Set(views.map((v: any) => v.calling_id)));
      }
    }

    refreshActionCounts();
  }, [profile?.id, demoMode, refreshActionCounts]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  function openCard(c: Calling) {
    // Demo cards now route to the detail screen — it loads the fixture
    // and short-circuits mutations to keep the real DB clean.
    navigation.navigate('CallingDetail', { callingId: c.id });
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  // A stake calling must be sustained in EVERY ward. That takes weeks, but the
  // person's own ward often sustains first and the card gets advanced to
  // set-apart — dragging it out from under the remaining wards. So sustaining
  // is tracked as a per-ward checklist ALONGSIDE the stage, not as a stage
  // gate: while any ward is outstanding the card keeps appearing in Sustain,
  // whatever stage it has actually reached.
  function wardsOutstanding(c: Calling): number {
    if (c.type !== 'stake_calling') return 0;
    if (c.stage === 'complete' || c.rejected) return 0;
    const sustained = sustainedWardMap[c.id] ?? new Set<string>();
    return wards.filter(w => !sustained.has(w.id)).length;
  }
  // Past the sustain stage but still collecting ward sustainings.
  function isSustainingOnly(c: Calling): boolean {
    const past = ['set_apart', 'record'];
    return past.includes(c.stage) && wardsOutstanding(c) > 0;
  }

  function sustainMeta(c: Calling) {
    if (c.type !== 'stake_calling' || wards.length === 0) return undefined;
    const outstanding = wardsOutstanding(c);
    if (outstanding === 0 && c.stage !== 'sustain') return undefined;
    return {
      sustainDone: wards.length - outstanding,
      sustainTotal: wards.length,
      sustainingOnly: isSustainingOnly(c),
    };
  }

  function filteredCallings(stages: string[]) {
    return callings.filter(c => {
      const sustainCol = stages.includes('sustain');
      if (!stages.includes(c.stage) && !(sustainCol && isSustainingOnly(c))) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (wardFilter !== 'all' && c.ward_id !== wardFilter) return false;
      if (assigneeFilter !== 'all') {
        // Match only the assignee responsible for the CURRENT stage. Once a
        // calling advances, prior-stage assignees should drop off the "Just
        // mine" view — they're done.
        const currentAssignee =
          c.stage === 'issue_calling' || c.stage === 'ordained' ? c.extend_by :
          c.stage === 'sustain'   ? c.sustain_by :
          c.stage === 'set_apart' ? c.set_apart_by :
          c.stage === 'record'    ? c.record_by :
          null;
        if (currentAssignee === assigneeFilter) return true;
        // For hc_approval stage, include cards where the HC member hasn't approved yet
        if (c.stage === 'hc_approval') {
          const hcMemberId = hcMemberIdMap[assigneeFilter];
          if (hcMemberId) {
            const key = `${c.id}:${hcMemberId}`;
            const approved = hcApprovalMap[key];
            if (approved === undefined || approved === false) return true;
          }
        }
        // For the Sustain column, surface cards that still need sustaining
        // in any of the HC member's assigned wards. Ward callings live in
        // one ward; stake callings need sustaining in every ward (tracked
        // per-ward via ward_sustainings).
        if (c.stage === 'sustain' || isSustainingOnly(c)) {
          const hcMemberId = hcMemberIdMap[assigneeFilter];
          const myWards = hcMemberId ? hcWardCoverage[hcMemberId] : undefined;
          if (myWards && myWards.size > 0) {
            if (c.type === 'stake_calling') {
              const sustained = sustainedWardMap[c.id] ?? new Set<string>();
              for (const wid of myWards) {
                if (!sustained.has(wid)) return true;
              }
            } else if (c.ward_id && myWards.has(c.ward_id)) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    });
  }

  function joinList(items: string[]): string {
    const and = t('script.listAnd');
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
    return items.slice(0, -1).join(', ') + `, ${and} ` + items[items.length - 1];
  }

  /**
   * Collapses entries that share a calling so a motion reads "A, B, and C as
   * Primary Teacher" instead of naming the calling once per person. The board
   * itself is ordered newest-entered-first, which scatters people called to the
   * same position; grouping and sorting here makes the read-aloud script stable
   * and predictable regardless of the order the cards were created in.
   *
   * The calling name is deliberately NOT pluralised. These are free-text titles
   * in two languages ("Stake YSA Committee", "First Counselor in Stake Primary")
   * and a guessed plural would be read aloud over the pulpit.
   */
  function groupByCalling(entries: { name: string; calling: string }[]): string[] {
    const groups = new Map<string, string[]>();
    for (const e of entries) {
      const existing = groups.get(e.calling);
      if (existing) existing.push(e.name);
      else groups.set(e.calling, [e.name]);
    }
    const collator = new Intl.Collator(language === 'es' ? 'es' : 'en');
    return [...groups.entries()]
      .sort(([a], [b]) => collator.compare(a, b))
      .map(([calling, names]) => `${joinList([...names].sort(collator.compare))} ${t('script.as')} ${calling}`);
  }

  function generateScript(ward: Ward): string {
    // Stake callings are sustained in every ward, not only the member's home
    // ward. A stake calling that has moved past sustain (its own ward already
    // sustained and set apart) still belongs in the remaining wards' scripts
    // until they've each sustained it — hence isSustainingOnly.
    const sustaining = callings.filter(c => {
      const inScope = c.ward_id === ward.id || c.type === 'stake_calling';
      if (!inScope) return false;
      if (c.stage === 'sustain') return true;
      if (!isSustainingOnly(c)) return false;
      // Only for wards that still owe a sustaining.
      return !(sustainedWardMap[c.id] ?? new Set<string>()).has(ward.id);
    });
    const locale = language === 'es' ? 'es-US' : 'en-US';
    const date = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

    const lines: string[] = [];
    lines.push(`${t('script.header')} — ${ward.name.toUpperCase()}`);
    lines.push(date);
    lines.push('');

    if (sustaining.length === 0) {
      lines.push(t('script.noCallings'));
      return lines.join('\n').trim();
    }

    // Two flavors of release: attached (a new calling that also releases the
    // previous holder — release_* fields) and standalone (is_release cards,
    // where member_name/calling_name ARE the release). Both read in the same
    // releases motion; standalone releases must never appear as sustainings.
    const releases = sustaining.filter(c => c.release_member_name);
    const standaloneReleases = sustaining.filter(c => c.is_release);
    const regularCallings = sustaining.filter(c => c.type !== 'mp_ordination' && !c.is_release);
    const ordinations = sustaining.filter(c => c.type === 'mp_ordination' && !c.is_release);

    // RELEASES — combined into one motion
    if (releases.length + standaloneReleases.length > 0) {
      lines.push(t('script.releasesHeader'));
      lines.push('');
      const releaseList = groupByCalling([
        ...releases.map(c => ({
          name: c.release_member_name as string,
          calling: c.release_current_calling || t('script.unknownCalling'),
        })),
        ...standaloneReleases.map(c => ({ name: c.member_name, calling: c.calling_name })),
      ]);
      lines.push(t('script.proposeRelease').replace('{list}', joinList(releaseList)));
      lines.push(t('script.releaseInFavor'));
      lines.push(t('script.thankYou'));
      lines.push('');
    }

    // SUSTAININGS — combined into one motion
    if (regularCallings.length > 0) {
      lines.push(t('script.sustainingsHeader'));
      lines.push('');
      const sustainList = groupByCalling(regularCallings.map(c => ({ name: c.member_name, calling: c.calling_name })));
      lines.push(t('script.proposeSustain').replace('{list}', joinList(sustainList)));
      lines.push(t('script.thoseInFavor'));
      lines.push(t('script.thoseOpposed'));
      lines.push('');
    }

    // MP ORDINATIONS — grouped by office (elders together, high priests together)
    if (ordinations.length > 0) {
      lines.push(t('script.ordinationsHeader'));
      lines.push('');

      const elders = ordinations.filter(c => c.ordination_type !== 'high_priest');
      const highPriests = ordinations.filter(c => c.ordination_type === 'high_priest');

      if (elders.length > 0) {
        const names = elders.map(c => c.member_name);
        if (names.length === 1) {
          lines.push(t('script.proposeOrdainElder').replace('{name}', names[0]));
        } else {
          lines.push(t('script.proposeOrdainElderPlural').replace('{list}', joinList(names)));
        }
        lines.push(t('script.thoseInFavor'));
        lines.push(t('script.thoseOpposed'));
        lines.push('');
      }

      if (highPriests.length > 0) {
        const names = highPriests.map(c => c.member_name);
        if (names.length === 1) {
          lines.push(t('script.proposeOrdainHighPriest').replace('{name}', names[0]));
        } else {
          lines.push(t('script.proposeOrdainHighPriestPlural').replace('{list}', joinList(names)));
        }
        lines.push(t('script.thoseInFavor'));
        lines.push(t('script.thoseOpposed'));
        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }

  async function handleCopyScript(text: string) {
    if (Platform.OS === 'web') {
      try {
        await (navigator as any).clipboard.writeText(text);
        setScriptCopied(true);
        setTimeout(() => setScriptCopied(false), 2500);
      } catch {}
    } else {
      await Share.share({ message: text });
    }
  }

  const activeWardFilter = wardFilter !== 'all' ? wards.find(w => w.id === wardFilter)?.abbreviation : null;
  const activeAssigneeFilter = assigneeFilter !== 'all' ? assigneeFilter : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('hcBoard.title')}</Text>
        {['stake_president', 'first_counselor', 'second_counselor', 'stake_clerk', 'exec_secretary'].includes(profile?.role ?? '') && (
          <TouchableOpacity
            style={[styles.reminderBtn, reminderSent && styles.reminderBtnDone]}
            onPress={sendHcReminder}
            disabled={reminderBusy || reminderSent}
          >
            <Ionicons name={reminderSent ? 'checkmark' : 'notifications-outline'} size={14} color={reminderSent ? Colors.success : Colors.primary} />
            <Text style={[styles.reminderBtnText, reminderSent && { color: Colors.success }]}>
              {reminderSent ? t('hcBoard.reminderSent') : reminderBusy ? '…' : t('hcBoard.reminderBtn')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <EnableNotificationsBanner />

      {/* Filter rows */}
      <View style={styles.filterBar}>
        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {TYPE_FILTERS.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, typeFilter === f.value && styles.filterChipActive]}
              onPress={() => setTypeFilter(f.value)}
            >
              <Text style={[styles.filterChipText, typeFilter === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ward + Assignee filters */}
        <View style={styles.filterRow2}>
          {myAssigneeName && (
            <TouchableOpacity
              style={[styles.filterChip, showingJustMine && styles.filterChipActive]}
              onPress={() => setAssigneeFilter(showingJustMine ? 'all' : myAssigneeName)}
            >
              <Text style={[styles.filterChipText, showingJustMine && styles.filterChipTextActive]}>
                {t('hcBoard.justMine')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.filterChip, wardFilter !== 'all' && styles.filterChipActive]}
            onPress={() => setShowWardFilter(true)}
          >
            <Text style={[styles.filterChipText, wardFilter !== 'all' && styles.filterChipTextActive]}>
              {activeWardFilter ? `${t('hcBoard.filterWard')}: ${activeWardFilter}` : t('hcBoard.allWards')}
            </Text>
          </TouchableOpacity>
          {wardFilter !== 'all' && (
            <TouchableOpacity style={styles.clearChip} onPress={() => setWardFilter('all')}>
              <Text style={styles.clearChipText}>✕</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.filterChip, assigneeFilter !== 'all' && styles.filterChipActive]}
            onPress={() => setShowAssigneeFilter(true)}
          >
            <Text style={[styles.filterChipText, assigneeFilter !== 'all' && styles.filterChipTextActive]}>
              {activeAssigneeFilter ? `${t('hcBoard.filterAssignee')}: ${activeAssigneeFilter.split(' ').pop()}` : t('hcBoard.allAssignees')}
            </Text>
          </TouchableOpacity>
          {assigneeFilter !== 'all' && (
            <TouchableOpacity style={styles.clearChip} onPress={() => setAssigneeFilter('all')}>
              <Text style={styles.clearChipText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isDesktopWeb ? (
        <ScrollView
          style={styles.board}
          contentContainerStyle={styles.boardContentDesktop}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={hcKanbanGridStyle as any}>
            {HC_COLUMNS.map(col => (
              <KanbanColumn
                key={col.label}
                title={col.label}
                color={col.color}
                callings={filteredCallings(col.stages)}
                viewedIds={viewedIds}
                onCardPress={openCard}
                cardMeta={col.stages.includes('sustain') ? sustainMeta : undefined}
                fluid
                headerAction={col.stages.includes('sustain') ? (
                  <TouchableOpacity
                    style={styles.scriptBtn}
                    onPress={() => { setScriptWard(null); setScriptCopied(false); setShowScriptModal(true); }}
                  >
                    <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
                    <Text style={styles.scriptBtnText}>{t('script.title')}</Text>
                  </TouchableOpacity>
                ) : undefined}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {HC_COLUMNS.map(col => (
            <KanbanColumn
              key={col.label}
              title={col.label}
              color={col.color}
              callings={filteredCallings(col.stages)}
              viewedIds={viewedIds}
              onCardPress={openCard}
              cardMeta={col.stages.includes('sustain') ? sustainMeta : undefined}
              headerAction={col.stages.includes('sustain') ? (
                <TouchableOpacity
                  style={styles.scriptBtn}
                  onPress={() => { setScriptWard(null); setScriptCopied(false); setShowScriptModal(true); }}
                >
                  <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
                  <Text style={styles.scriptBtnText}>{t('script.title')}</Text>
                </TouchableOpacity>
              ) : undefined}
            />
          ))}
        </ScrollView>
      )}

      {/* Ward Filter Modal */}
      <Modal visible={showWardFilter} transparent animationType="slide" onRequestClose={() => setShowWardFilter(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowWardFilter(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('hcBoard.filterByWard')}</Text>
            <TouchableOpacity
              style={[styles.modalItem, wardFilter === 'all' && styles.modalItemSelected]}
              onPress={() => { setWardFilter('all'); setShowWardFilter(false); }}
            >
              <Text style={[styles.modalItemText, wardFilter === 'all' && styles.modalItemTextSelected]}>{t('hcBoard.allWards')}</Text>
            </TouchableOpacity>
            <FlatList
              data={wards}
              keyExtractor={w => w.id}
              renderItem={({ item: w }) => (
                <TouchableOpacity
                  style={[styles.modalItem, wardFilter === w.id && styles.modalItemSelected]}
                  onPress={() => { setWardFilter(w.id); setShowWardFilter(false); }}
                >
                  <Text style={[styles.modalItemText, wardFilter === w.id && styles.modalItemTextSelected]}>{w.name}</Text>
                  <Text style={styles.modalItemSub}>{w.abbreviation}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assignee Filter Modal */}
      <Modal visible={showAssigneeFilter} transparent animationType="slide" onRequestClose={() => setShowAssigneeFilter(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAssigneeFilter(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('hcBoard.filterByAssignee')}</Text>
            <TouchableOpacity
              style={[styles.modalItem, assigneeFilter === 'all' && styles.modalItemSelected]}
              onPress={() => { setAssigneeFilter('all'); setShowAssigneeFilter(false); }}
            >
              <Text style={[styles.modalItemText, assigneeFilter === 'all' && styles.modalItemTextSelected]}>{t('hcBoard.allAssignees')}</Text>
            </TouchableOpacity>
            <FlatList
              data={assigneeOptions}
              keyExtractor={a => a.name}
              renderItem={({ item: a }) => (
                <TouchableOpacity
                  style={[styles.modalItem, assigneeFilter === a.name && styles.modalItemSelected]}
                  onPress={() => { setAssigneeFilter(a.name); setShowAssigneeFilter(false); }}
                >
                  <Text style={[styles.modalItemText, assigneeFilter === a.name && styles.modalItemTextSelected]}>{a.name}</Text>
                  <Text style={styles.modalItemSub}>{a.subtitle}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Sustaining Script Modal */}
      <Modal visible={showScriptModal} transparent animationType="slide" onRequestClose={() => { setShowScriptModal(false); setScriptWard(null); }}>
        <View style={styles.scriptModalOverlay}>
          <View style={styles.scriptModalSheet}>
            {/* Header */}
            <View style={styles.scriptModalHeader}>
              <TouchableOpacity onPress={() => { if (scriptWard) { setScriptWard(null); } else { setShowScriptModal(false); } }}>
                <Ionicons name={scriptWard ? 'chevron-back' : 'close'} size={22} color={Colors.gray[700]} />
              </TouchableOpacity>
              <Text style={styles.scriptModalTitle}>
                {scriptWard ? `${t('script.scriptFor')} — ${scriptWard.name}` : t('script.title')}
              </Text>
              {scriptWard ? (
                <TouchableOpacity onPress={() => handleCopyScript(generateScript(scriptWard))}>
                  <View style={[styles.copyBtn, scriptCopied && styles.copyBtnDone]}>
                    <Ionicons name={scriptCopied ? 'checkmark' : 'copy-outline'} size={15} color={scriptCopied ? Colors.success : Colors.primary} />
                    <Text style={[styles.copyBtnText, scriptCopied && styles.copyBtnTextDone]}>
                      {scriptCopied ? t('script.copied') : t('script.copy')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : <View style={{ width: 60 }} />}
            </View>

            {!scriptWard ? (
              /* Ward picker */
              <>
                <Text style={styles.scriptPickerHint}>{t('script.pickerHint')}</Text>
                <FlatList
                  data={wards}
                  keyExtractor={w => w.id}
                  renderItem={({ item: w }) => {
                    const count = callings.filter(c =>
                      c.stage === 'sustain' && (c.ward_id === w.id || c.type === 'stake_calling')
                    ).length;
                    return (
                      <TouchableOpacity
                        style={styles.scriptWardItem}
                        onPress={() => { setScriptWard(w); setScriptCopied(false); }}
                      >
                        <View>
                          <Text style={styles.scriptWardName}>{w.name}</Text>
                          <Text style={styles.scriptWardCount}>{count} {t(count !== 1 ? 'script.callingsPlural' : 'script.callingsSingular')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            ) : (
              /* Script display */
              <ScrollView style={styles.scriptScroll} contentContainerStyle={styles.scriptScrollContent}>
                <Text style={styles.scriptText}>{generateScript(scriptWard)}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <DisclaimerFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  reminderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.primaryFade,
  },
  reminderBtnDone: { borderColor: Colors.success, backgroundColor: '#ecfdf5' },
  reminderBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  filterBar: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100] },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, flexDirection: 'row', gap: Spacing.xs },
  filterRow2: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingBottom: Spacing.xs, gap: Spacing.xs, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  filterChipText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  filterChipTextActive: { color: Colors.primary, fontWeight: '700' },
  clearChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, backgroundColor: Colors.gray[200],
  },
  clearChipText: { fontSize: FontSize.xs, color: Colors.gray[600], fontWeight: '700' },
  board: { flex: 1 },
  boardContent: { padding: Spacing.md, flexDirection: 'row', alignItems: 'stretch' },
  boardContentDesktop: { padding: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, maxHeight: '60%', paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900],
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemSub: { fontSize: FontSize.sm, color: Colors.gray[400] },
  scriptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary + '60',
    backgroundColor: Colors.primaryFade, alignSelf: 'flex-start',
  },
  scriptBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  scriptModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  scriptModalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, maxHeight: '85%', paddingBottom: Spacing.lg,
  },
  scriptModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  scriptModalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], flex: 1, textAlign: 'center' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary + '60',
    backgroundColor: Colors.primaryFade,
  },
  copyBtnDone: { borderColor: Colors.success + '60', backgroundColor: Colors.success + '10' },
  copyBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  copyBtnTextDone: { color: Colors.success },
  scriptPickerHint: {
    fontSize: FontSize.sm, color: Colors.gray[500], paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  scriptWardItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  scriptWardName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[800] },
  scriptWardCount: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 2 },
  scriptScroll: { flex: 1 },
  scriptScrollContent: { padding: Spacing.lg },
  scriptText: { fontSize: FontSize.sm, color: Colors.gray[800], lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
});

// CSS Grid layout for the HC kanban on desktop web. Same recipe as the SP
// board — react-native-web passes these style fields through to the DOM.
const hcKanbanGridStyle = {
  display: 'grid' as const,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: Spacing.sm + 2,
  alignItems: 'stretch' as const,
};
