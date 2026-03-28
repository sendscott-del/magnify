import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Calling, CallingLogEntry, WardSustaining, Ward, Stage } from '../../lib/database.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { STAGE_LABELS } from '../../constants/callings';
import {
  canAdvanceStage,
  canReject,
  getNextStage,
  getAdvanceLabel,
} from '../../lib/permissions';

const TYPE_LABELS: Record<string, string> = {
  ward_calling: 'Ward Calling',
  stake_calling: 'Stake Calling',
  mp_ordination: 'MP Ordination',
};

const TYPE_COLORS: Record<string, string> = {
  ward_calling: Colors.info,
  stake_calling: '#8B5CF6',
  mp_ordination: Colors.success,
};

const SP_ROLES: { role: string; label: string }[] = [
  { role: 'stake_president', label: 'Stake President' },
  { role: 'first_counselor', label: 'First Counselor' },
  { role: 'second_counselor', label: 'Second Counselor' },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'MMM d, yyyy'); } catch { return dateStr; }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'MMM d, yyyy h:mm a'); } catch { return dateStr; }
}

// ─── Ward Sustaining ─────────────────────────────────────────────────────────

interface WardSustainingProps {
  callingId: string;
  wards: Ward[];
  canToggle: boolean;
  userId?: string;
}

function WardSustainingSection({ callingId, wards, canToggle, userId }: WardSustainingProps) {
  const [sustainings, setSustainingsList] = useState<WardSustaining[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('ward_sustainings')
      .select('*, wards(id,name,abbreviation)')
      .eq('calling_id', callingId);
    setSustainingsList((data as WardSustaining[]) ?? []);
  }, [callingId]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  async function toggle(wardId: string) {
    if (!canToggle) return;
    const existing = sustainings.find(s => s.ward_id === wardId);
    if (existing) {
      const newVal = !existing.sustained;
      await supabase.from('ward_sustainings').update({
        sustained: newVal,
        sustained_at: newVal ? new Date().toISOString() : null,
        sustained_by: userId,
      }).eq('id', existing.id);
    } else {
      await supabase.from('ward_sustainings').insert({
        calling_id: callingId, ward_id: wardId,
        sustained: true, sustained_at: new Date().toISOString(), sustained_by: userId,
      });
    }
    fetch();
  }

  return (
    <View style={sustainStyles.container}>
      <Text style={sustainStyles.title}>Ward Sustainings</Text>
      <View style={sustainStyles.grid}>
        {wards.map(ward => {
          const s = sustainings.find(sx => sx.ward_id === ward.id);
          const isSustained = s?.sustained ?? false;
          return (
            <TouchableOpacity
              key={ward.id}
              style={[sustainStyles.chip, isSustained && sustainStyles.chipSustained]}
              onPress={() => toggle(ward.id)}
              disabled={!canToggle}
            >
              <Text style={[sustainStyles.chipLabel, isSustained && sustainStyles.chipLabelSustained]}>
                {ward.abbreviation}
              </Text>
              {isSustained && s?.sustained_at && (
                <Text style={sustainStyles.chipDate}>{format(new Date(s.sustained_at), 'M/d')}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={sustainStyles.hint}>
        {sustainings.filter(s => s.sustained).length} / {wards.length} wards sustained
      </Text>
    </View>
  );
}

const sustainStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200],
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.gray[300],
    backgroundColor: Colors.gray[50], alignItems: 'center', minWidth: 44,
  },
  chipSustained: { borderColor: Colors.success, backgroundColor: Colors.success + '15' },
  chipLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gray[600] },
  chipLabelSustained: { color: Colors.success },
  chipDate: { fontSize: 9, color: Colors.success, fontWeight: '600', marginTop: 1 },
  hint: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs },
});

// ─── Stake Presidency Approval ────────────────────────────────────────────────

interface SPApproval {
  id: string;
  calling_id: string;
  role: string;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
}

interface SPApprovalSectionProps {
  callingId: string;
  approvals: SPApproval[];
  canToggle: boolean;
  userRole?: string;
  onToggle: (role: string, current: boolean) => Promise<void>;
}

function StakePresidencyApprovalSection({ callingId, approvals, canToggle, userRole, onToggle }: SPApprovalSectionProps) {
  const presidentApproved = approvals.find(a => a.role === 'stake_president')?.approved ?? false;
  const allApproved = SP_ROLES.every(r => approvals.find(a => a.role === r.role)?.approved ?? false);
  const approvedCount = SP_ROLES.filter(r => approvals.find(a => a.role === r.role)?.approved).length;

  return (
    <View style={spStyles.container}>
      <Text style={spStyles.title}>Stake Presidency Approval</Text>
      {SP_ROLES.map(({ role, label }) => {
        const rec = approvals.find(a => a.role === role);
        const isApproved = rec?.approved ?? false;
        const canCheck = canToggle && (
          userRole === role ||
          userRole === 'stake_president' ||
          userRole === 'stake_clerk' ||
          userRole === 'exec_secretary'
        );
        return (
          <TouchableOpacity
            key={role}
            style={spStyles.row}
            onPress={() => canCheck ? onToggle(role, isApproved) : undefined}
            disabled={!canCheck}
          >
            <View style={[spStyles.checkbox, isApproved && spStyles.checkboxOn]}>
              {isApproved && <Text style={spStyles.checkMark}>✓</Text>}
            </View>
            <Text style={spStyles.label}>{label}</Text>
            {isApproved && rec?.approved_at && (
              <Text style={spStyles.date}>{format(new Date(rec.approved_at), 'M/d')}</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={[spStyles.status, (presidentApproved || allApproved) && spStyles.statusReady]}>
        {approvedCount}/3 approved
        {presidentApproved ? ' — Stake President approved ✓' : allApproved ? ' — All approved ✓' : ' — Awaiting approval'}
      </Text>
    </View>
  );
}

const spStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200],
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: Colors.gray[300], marginRight: Spacing.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  label: { flex: 1, fontSize: FontSize.md, color: Colors.gray[700] },
  date: { fontSize: FontSize.xs, color: Colors.gray[400] },
  status: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs, fontStyle: 'italic' },
  statusReady: { color: Colors.success, fontWeight: '600', fontStyle: 'normal' },
});

// ─── HC Approval ─────────────────────────────────────────────────────────────

interface HCMember {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

interface HCApproval {
  id: string;
  calling_id: string;
  hc_member_id: string;
  approved: boolean;
  approved_at: string | null;
}

interface HCApprovalSectionProps {
  hcMembers: HCMember[];
  hcApprovals: HCApproval[];
  canToggle: boolean;
  spOverride: boolean;
  onToggle: (memberId: string, current: boolean) => Promise<void>;
}

function HCApprovalSection({ hcMembers, hcApprovals, canToggle, spOverride, onToggle }: HCApprovalSectionProps) {
  const activeMembers = hcMembers.filter(m => m.active);
  const approvedCount = hcApprovals.filter(a => a.approved).length;
  const needed = Math.ceil(activeMembers.length / 2);
  const isReady = spOverride || activeMembers.length === 0 || approvedCount >= needed;

  if (activeMembers.length === 0) {
    return (
      <View style={hcStyles.container}>
        <Text style={hcStyles.title}>High Council Approval</Text>
        <Text style={hcStyles.empty}>No HC members configured. Add them in Settings → Manage High Council.</Text>
      </View>
    );
  }

  return (
    <View style={hcStyles.container}>
      <View style={hcStyles.titleRow}>
        <Text style={hcStyles.title}>High Council Approval</Text>
        {spOverride && (
          <View style={hcStyles.overrideBadge}>
            <Text style={hcStyles.overrideBadgeText}>SP Override</Text>
          </View>
        )}
      </View>
      {activeMembers.map(member => {
        const rec = hcApprovals.find(a => a.hc_member_id === member.id);
        const isApproved = rec?.approved ?? false;
        return (
          <TouchableOpacity
            key={member.id}
            style={hcStyles.row}
            onPress={() => canToggle ? onToggle(member.id, isApproved) : undefined}
            disabled={!canToggle}
          >
            <View style={[hcStyles.checkbox, isApproved && hcStyles.checkboxOn]}>
              {isApproved && <Text style={hcStyles.checkMark}>✓</Text>}
            </View>
            <Text style={hcStyles.label}>{member.name}</Text>
            {isApproved && rec?.approved_at && (
              <Text style={hcStyles.date}>{format(new Date(rec.approved_at), 'M/d')}</Text>
            )}
          </TouchableOpacity>
        );
      })}
      <Text style={[hcStyles.status, isReady && hcStyles.statusReady]}>
        {spOverride
          ? 'Stake President override — HC threshold bypassed ✓'
          : `${approvedCount}/${activeMembers.length} approved — need ${needed}${isReady ? ' ✓' : ''}`}
      </Text>
    </View>
  );
}

const hcStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800] },
  overrideBadge: {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  overrideBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  empty: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: Colors.gray[300], marginRight: Spacing.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  checkboxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  label: { flex: 1, fontSize: FontSize.md, color: Colors.gray[700] },
  date: { fontSize: FontSize.xs, color: Colors.gray[400] },
  status: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs, fontStyle: 'italic' },
  statusReady: { color: Colors.success, fontWeight: '600', fontStyle: 'normal' },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function CallingDetailScreen({ route, navigation }: any) {
  const { callingId } = route.params;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [calling, setCalling] = useState<Calling | null>(null);
  const [log, setLog] = useState<CallingLogEntry[]>([]);
  const [allWards, setAllWards] = useState<Ward[]>([]);
  const [spApprovals, setSpApprovals] = useState<SPApproval[]>([]);
  const [hcApprovals, setHcApprovals] = useState<HCApproval[]>([]);
  const [hcMembers, setHcMembers] = useState<HCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [callingRes, logRes, wardsRes, spRes, hcMembersRes, hcApprovalsRes] = await Promise.all([
      supabase.from('callings')
        .select('*, wards(id,name,abbreviation,sort_order), profiles(id,full_name,email,role,status,created_at)')
        .eq('id', callingId).single(),
      supabase.from('calling_log')
        .select('*, profiles(id,full_name,email,role,status,created_at)')
        .eq('calling_id', callingId).order('created_at', { ascending: false }),
      supabase.from('wards').select('*').order('name'),
      supabase.from('stake_presidency_approvals').select('*').eq('calling_id', callingId),
      supabase.from('high_council_members').select('*').eq('active', true).order('sort_order'),
      supabase.from('hc_approvals').select('*').eq('calling_id', callingId),
    ]);
    setCalling(callingRes.data as Calling ?? null);
    setLog((logRes.data as CallingLogEntry[]) ?? []);
    setAllWards((wardsRes.data as Ward[]) ?? []);
    setSpApprovals((spRes.data as SPApproval[]) ?? []);
    setHcMembers((hcMembersRes.data as HCMember[]) ?? []);
    setHcApprovals((hcApprovalsRes.data as HCApproval[]) ?? []);
    setLoading(false);
  }, [callingId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  async function toggleSPApproval(role: string, current: boolean) {
    const newVal = !current;
    await supabase.from('stake_presidency_approvals').upsert({
      calling_id: callingId,
      role,
      approved: newVal,
      approved_at: newVal ? new Date().toISOString() : null,
      approved_by: profile?.id ?? null,
    }, { onConflict: 'calling_id,role' });
    setSpApprovals(prev => {
      const existing = prev.find(a => a.role === role);
      if (existing) {
        return prev.map(a => a.role === role ? { ...a, approved: newVal, approved_at: newVal ? new Date().toISOString() : null } : a);
      }
      return [...prev, { id: '', calling_id: callingId, role, approved: newVal, approved_at: newVal ? new Date().toISOString() : null, approved_by: profile?.id ?? null }];
    });
  }

  async function toggleHCApproval(memberId: string, current: boolean) {
    const newVal = !current;
    await supabase.from('hc_approvals').upsert({
      calling_id: callingId,
      hc_member_id: memberId,
      approved: newVal,
      approved_at: newVal ? new Date().toISOString() : null,
    }, { onConflict: 'calling_id,hc_member_id' });
    setHcApprovals(prev => {
      const existing = prev.find(a => a.hc_member_id === memberId);
      if (existing) {
        return prev.map(a => a.hc_member_id === memberId ? { ...a, approved: newVal, approved_at: newVal ? new Date().toISOString() : null } : a);
      }
      return [...prev, { id: '', calling_id: callingId, hc_member_id: memberId, approved: newVal, approved_at: newVal ? new Date().toISOString() : null }];
    });
  }

  // Check whether approval thresholds are met for stages that require them
  function approvalsReady(): boolean {
    if (!calling) return false;
    if (calling.stage === 'for_approval') {
      const presidentApproved = spApprovals.find(a => a.role === 'stake_president')?.approved ?? false;
      const allApproved = SP_ROLES.every(r => spApprovals.find(a => a.role === r.role)?.approved ?? false);
      return presidentApproved || allApproved;
    }
    if (calling.stage === 'hc_approval') {
      // Stake President can override HC threshold
      const spOverride = spApprovals.find(a => a.role === 'stake_president')?.approved ?? false;
      if (spOverride) return true;
      const activeCount = hcMembers.filter(m => m.active).length;
      if (activeCount === 0) return true;
      const approvedCount = hcApprovals.filter(a => a.approved).length;
      return approvedCount >= Math.ceil(activeCount / 2);
    }
    return true;
  }

  async function handleAdvance() {
    if (!calling || !profile) return;
    const next = getNextStage(calling.stage, calling.type);
    if (!next) return;

    if (!approvalsReady()) {
      const msg = calling.stage === 'for_approval'
        ? 'Stake Presidency approval is required. The Stake President must approve, or all three members must approve.'
        : 'At least half of the High Council must approve before advancing.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Approvals Needed', msg);
      }
      return;
    }

    setActionLoading(true);
    const label = getAdvanceLabel(calling.stage, calling.type);
    const update: any = { stage: next };
    if (next === 'complete') update.completed_at = new Date().toISOString();

    await supabase.from('callings').update(update).eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: label,
      from_stage: calling.stage, to_stage: next, performed_by: profile.id,
    });

    await fetchData();
    setSuccessMsg(`Moved to: ${STAGE_LABELS[next]}`);
    setTimeout(() => setSuccessMsg(''), 3000);
    setActionLoading(false);
  }

  async function handleReject() {
    if (!calling || !profile) return;
    setRejectLoading(true);
    await supabase.from('callings')
      .update({ rejected: true, rejection_notes: rejectionNotes })
      .eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: 'Rejected',
      from_stage: calling.stage, performed_by: profile.id,
      notes: rejectionNotes || null,
    });
    setShowRejectModal(false);
    setRejectionNotes('');
    await fetchData();
    setRejectLoading(false);
  }

  async function handleUnreject() {
    if (!calling || !profile) return;
    setActionLoading(true);
    await supabase.from('callings').update({ rejected: false, rejection_notes: null }).eq('id', calling.id);
    await supabase.from('calling_log').insert({
      calling_id: calling.id, action: 'Rejection cleared',
      from_stage: calling.stage, performed_by: profile.id,
    });
    await fetchData();
    setActionLoading(false);
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!calling) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundText}>Calling not found.</Text>
        <Button title="Go Back" onPress={() => navigation.goBack()} variant="outline" />
      </View>
    );
  }

  const role = profile?.role;
  const canAdvance = role ? canAdvanceStage(role, calling.stage, calling.type) : false;
  const canRejectCalling = role ? canReject(role, calling.stage) : false;
  const advanceLabel = getAdvanceLabel(calling.stage, calling.type);
  const isComplete = calling.stage === 'complete';

  const showSustaining =
    calling.type === 'stake_calling' &&
    ['sustain', 'set_apart', 'record', 'complete'].includes(calling.stage);

  const showSPApprovals = ['for_approval', 'stake_approved', 'hc_approval'].includes(calling.stage);
  const showHCApprovals = ['hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record', 'complete'].includes(calling.stage);

  const canToggleSP = !!(role && ['stake_president','first_counselor','second_counselor','stake_clerk','exec_secretary'].includes(role));
  const canToggleHC = !!(role && ['stake_president','high_councilor','stake_clerk','exec_secretary'].includes(role));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View style={styles.headerBadges}>
          <Badge label={TYPE_LABELS[calling.type]} color={TYPE_COLORS[calling.type]} />
          <View style={{ width: Spacing.xs }} />
          <Badge label={STAGE_LABELS[calling.stage]} stage={calling.stage} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Name & Calling */}
        <View style={styles.heroSection}>
          <Text style={styles.memberName}>{calling.member_name}</Text>
          <Text style={styles.callingNameText}>{calling.calling_name}</Text>
        </View>

        {/* Rejection Banner */}
        {calling.rejected && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedRow}>
              <Ionicons name="close-circle" size={20} color={Colors.error} />
              <Text style={styles.rejectedTitle}>Rejected</Text>
            </View>
            {calling.rejection_notes ? <Text style={styles.rejectedNotes}>{calling.rejection_notes}</Text> : null}
            {canAdvance && (
              <TouchableOpacity onPress={handleUnreject} style={styles.unrejectBtn}>
                <Text style={styles.unrejectBtnText}>Clear Rejection</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Success Message */}
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.successBannerText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ward</Text>
              <Text style={styles.infoValue}>{calling.wards?.name ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{TYPE_LABELS[calling.type]}</Text>
            </View>
            {calling.ordination_type && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Ordination</Text>
                <Text style={styles.infoValue}>{calling.ordination_type === 'elder' ? 'Elder' : 'High Priest'}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created By</Text>
              <Text style={styles.infoValue}>{calling.profiles?.full_name ?? '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>{formatDate(calling.created_at)}</Text>
            </View>
            {calling.completed_at && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Completed</Text>
                <Text style={styles.infoValue}>{formatDate(calling.completed_at)}</Text>
              </View>
            )}
          </View>
          {calling.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.notesText}>{calling.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Stake Presidency Approvals */}
        {showSPApprovals && (
          <StakePresidencyApprovalSection
            callingId={callingId}
            approvals={spApprovals}
            canToggle={canToggleSP && !isComplete}
            userRole={role}
            onToggle={toggleSPApproval}
          />
        )}

        {/* HC Approvals */}
        {showHCApprovals && (
          <HCApprovalSection
            hcMembers={hcMembers}
            hcApprovals={hcApprovals}
            canToggle={canToggleHC && !isComplete}
            spOverride={spApprovals.find(a => a.role === 'stake_president')?.approved ?? false}
            onToggle={toggleHCApproval}
          />
        )}

        {/* Ward Sustaining (stake callings only) */}
        {showSustaining && allWards.length > 0 && (
          <WardSustainingSection
            callingId={calling.id}
            wards={allWards}
            canToggle={!!(role && ['high_councilor','stake_clerk','exec_secretary','stake_president'].includes(role))}
            userId={profile?.id}
          />
        )}

        {/* Action Buttons */}
        {!isComplete && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {canAdvance && !calling.rejected && (
              <Button
                title={advanceLabel}
                onPress={handleAdvance}
                loading={actionLoading}
                fullWidth
                size="lg"
                style={styles.advanceBtn}
              />
            )}
            {canRejectCalling && !calling.rejected && (
              <Button
                title="Reject"
                onPress={() => setShowRejectModal(true)}
                variant="danger"
                fullWidth
                style={styles.rejectBtn}
              />
            )}
            {!canAdvance && !canRejectCalling && (
              <Text style={styles.noActionsText}>
                You don't have permission to advance or reject this calling at its current stage.
              </Text>
            )}
          </View>
        )}

        {/* Timeline Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          {log.length === 0 ? (
            <Text style={styles.emptyLog}>No activity yet.</Text>
          ) : (
            log.map((entry, index) => (
              <View key={entry.id} style={styles.logEntry}>
                <View style={styles.logDot} />
                {index < log.length - 1 && <View style={styles.logLine} />}
                <View style={styles.logContent}>
                  <View style={styles.logTopRow}>
                    <Text style={styles.logAction}>{entry.action}</Text>
                    <Text style={styles.logTime}>{formatDateTime(entry.created_at)}</Text>
                  </View>
                  {entry.profiles && (
                    <Text style={styles.logPerformer}>by {entry.profiles.full_name}</Text>
                  )}
                  {entry.from_stage && entry.to_stage && (
                    <Text style={styles.logStageChange}>
                      {STAGE_LABELS[entry.from_stage as Stage]} → {STAGE_LABELS[entry.to_stage as Stage]}
                    </Text>
                  )}
                  {entry.notes && <Text style={styles.logNotes}>{entry.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRejectModal(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Reject Calling</Text>
            <Text style={styles.modalSubtitle}>Optionally provide notes explaining the rejection.</Text>
            <TextInput
              style={styles.modalTextInput}
              value={rejectionNotes}
              onChangeText={setRejectionNotes}
              placeholder="Rejection notes (optional)…"
              placeholderTextColor={Colors.gray[400]}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setShowRejectModal(false)} variant="outline" style={styles.modalCancelBtn} />
              <Button title="Confirm Reject" onPress={handleReject} variant="danger" loading={rejectLoading} style={styles.modalConfirmBtn} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  notFoundText: { fontSize: FontSize.lg, color: Colors.gray[500], marginBottom: Spacing.md },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  backBtn: { padding: Spacing.xs },
  headerBadges: { flexDirection: 'row', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  heroSection: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  memberName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  callingNameText: { fontSize: FontSize.lg, color: Colors.gray[700], fontWeight: '500' },
  rejectedBanner: {
    backgroundColor: Colors.error + '10', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '40',
  },
  rejectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rejectedTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.error, marginLeft: Spacing.xs },
  rejectedNotes: { fontSize: FontSize.sm, color: Colors.error, marginTop: 4 },
  unrejectBtn: {
    marginTop: Spacing.sm, alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.error,
  },
  unrejectBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.success + '15', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.success + '40', gap: Spacing.xs,
  },
  successBannerText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: '600' },
  section: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200],
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], marginBottom: Spacing.md },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  infoItem: { minWidth: '45%', flex: 1 },
  infoLabel: {
    fontSize: FontSize.xs, color: Colors.gray[400], fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2,
  },
  infoValue: { fontSize: FontSize.md, color: Colors.gray[800], fontWeight: '500' },
  notesBox: { marginTop: Spacing.md, backgroundColor: Colors.gray[50], borderRadius: Radius.sm, padding: Spacing.sm },
  notesText: { fontSize: FontSize.md, color: Colors.gray[700], lineHeight: 22, marginTop: 4 },
  advanceBtn: { marginBottom: Spacing.sm },
  rejectBtn: {},
  noActionsText: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic', textAlign: 'center', padding: Spacing.sm },
  emptyLog: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic' },
  logEntry: { flexDirection: 'row', marginBottom: Spacing.md, position: 'relative' },
  logDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 5, marginRight: Spacing.sm, flexShrink: 0 },
  logLine: { position: 'absolute', left: 4, top: 14, bottom: -Spacing.md, width: 2, backgroundColor: Colors.gray[200] },
  logContent: { flex: 1 },
  logTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 },
  logAction: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[800], flex: 1 },
  logTime: { fontSize: FontSize.xs, color: Colors.gray[400], flexShrink: 0 },
  logPerformer: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  logStageChange: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  logNotes: { fontSize: FontSize.sm, color: Colors.gray[600], marginTop: 4, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.gray[900], marginBottom: Spacing.xs },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginBottom: Spacing.md },
  modalTextInput: {
    backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200],
    borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.black,
    minHeight: 100, textAlignVertical: 'top', marginBottom: Spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
  modalCancelBtn: { flex: 1 },
  modalConfirmBtn: { flex: 1 },
});
