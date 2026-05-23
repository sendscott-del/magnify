import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/database.types';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { ROLE_LABELS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';

const ALL_ROLES: UserRole[] = [
  'stake_president', 'first_counselor', 'second_counselor',
  'high_councilor', 'stake_clerk', 'exec_secretary',
];

// Roles that live in sp_members; anything else (today: high_councilor) lives in
// high_council_members. Keep this list in sync with SPMember['role'] below.
const SP_ROSTER_ROLES: UserRole[] = [
  'stake_president', 'first_counselor', 'second_counselor', 'stake_clerk', 'exec_secretary',
];

interface SPMember {
  id: string; name: string;
  role: 'stake_president' | 'first_counselor' | 'second_counselor' | 'stake_clerk' | 'exec_secretary';
  sort_order: number; active: boolean; slack_user_id: string | null;
}

interface HCMember {
  id: string; name: string; sort_order: number; active: boolean; slack_user_id: string | null;
}

// Unified row built from any combination of profiles + sp_members +
// high_council_members. Joined by case-insensitive name match, with the
// profile (if any) treated as the canonical record.
interface UnifiedUser {
  key: string;             // dedup key — lowercased name
  name: string;
  email: string | null;
  role: UserRole;
  slackUserId: string | null;
  profile: Profile | null;
  sp: SPMember | null;
  hc: HCMember | null;
}

type TabId = 'users' | 'suite';

const norm = (s: string) => s.trim().toLowerCase();

function rosterForRole(role: UserRole): 'sp' | 'hc' {
  return SP_ROSTER_ROLES.includes(role) ? 'sp' : 'hc';
}

// Mirrors public.gather_roles_catalog on the shared Supabase project.
type SuiteScope = 'stake' | 'ward';
const SUITE_ROLES: Array<{ key: string; label: string; scope: SuiteScope }> = [
  { key: 'stake_president', label: 'Stake President', scope: 'stake' },
  { key: 'stake_clerk', label: 'Stake Clerk', scope: 'stake' },
  { key: 'sp_1st_counselor', label: 'Stake Presidency 1st Counselor', scope: 'stake' },
  { key: 'sp_2nd_counselor', label: 'Stake Presidency 2nd Counselor', scope: 'stake' },
  { key: 'stake_exec_secretary', label: 'Stake Executive Secretary', scope: 'stake' },
  { key: 'high_councilor', label: 'High Councilor', scope: 'stake' },
  { key: 'hc_missionary_work', label: 'High Councilor — Missionary Work', scope: 'stake' },
  { key: 'hc_welfare_self_reliance', label: 'High Councilor — Welfare & Self Reliance', scope: 'stake' },
  { key: 'community_events_leader', label: 'Community Events Leader', scope: 'stake' },
  { key: 'stake_council', label: 'Stake Council', scope: 'stake' },
  { key: 'bishop', label: 'Bishop', scope: 'ward' },
  { key: 'bishopric_1st_counselor', label: 'Bishopric 1st Counselor', scope: 'ward' },
  { key: 'bishopric_2nd_counselor', label: 'Bishopric 2nd Counselor', scope: 'ward' },
  { key: 'ward_clerk', label: 'Ward Clerk', scope: 'ward' },
  { key: 'ward_exec_secretary', label: 'Ward Executive Secretary', scope: 'ward' },
  { key: 'ward_council', label: 'Ward Council', scope: 'ward' },
  { key: 'ward_org_presidency', label: 'Ward Organization Presidency', scope: 'ward' },
  { key: 'ward_mission_leader', label: 'Ward Mission Leader', scope: 'ward' },
  { key: 'ward_member', label: 'Ward Member', scope: 'ward' },
];

export function UserRolesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('users');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('userRoles.title')}</Text>
      </View>

      <View style={styles.tabRow}>
        {([
          { id: 'users' as TabId, label: t('userRoles.usersTab') },
          { id: 'suite' as TabId, label: t('userRoles.suiteTab') },
        ]).map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'users' && <UnifiedUsersTab />}
        {activeTab === 'suite' && <SuiteTab />}
      </ScrollView>
    </View>
  );
}

// ─── Unified users tab ────────────────────────────────────────────────────────

function UnifiedUsersTab() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [spMembers, setSpMembers] = useState<SPMember[]>([]);
  const [hcMembers, setHcMembers] = useState<HCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<UnifiedUser | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, sp, hc] = await Promise.all([
      supabase.from('profiles').select('*').eq('status', 'approved').order('full_name'),
      supabase.from('sp_members').select('*').eq('active', true).order('sort_order'),
      supabase.from('high_council_members').select('*').eq('active', true).order('sort_order'),
    ]);
    setProfiles((p.data as Profile[]) ?? []);
    setSpMembers((sp.data as SPMember[]) ?? []);
    setHcMembers((hc.data as HCMember[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  // Build the unified list, deduped by case-insensitive name.
  const unified: UnifiedUser[] = useMemo(() => {
    const byKey = new Map<string, UnifiedUser>();
    const ensure = (name: string): UnifiedUser => {
      const key = norm(name);
      let row = byKey.get(key);
      if (!row) {
        row = { key, name, email: null, role: 'stake_clerk', slackUserId: null, profile: null, sp: null, hc: null };
        byKey.set(key, row);
      }
      return row;
    };

    for (const p of profiles) {
      const row = ensure(p.full_name);
      row.profile = p;
      row.name = p.full_name;
      row.email = p.email;
      row.role = p.role as UserRole;
    }
    for (const sp of spMembers) {
      const row = ensure(sp.name);
      row.sp = sp;
      if (!row.profile) row.role = sp.role as UserRole;
      if (sp.slack_user_id) row.slackUserId = sp.slack_user_id;
    }
    for (const hc of hcMembers) {
      const row = ensure(hc.name);
      row.hc = hc;
      if (!row.profile) row.role = 'high_councilor';
      if (hc.slack_user_id) row.slackUserId = hc.slack_user_id;
    }
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, spMembers, hcMembers]);

  const filtered = filter
    ? unified.filter(u =>
        u.name.toLowerCase().includes(filter.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(filter.toLowerCase()) ||
        ROLE_LABELS[u.role].toLowerCase().includes(filter.toLowerCase())
      )
    : unified;

  async function handleSave(u: UnifiedUser, edits: { name: string; role: UserRole; slackUserId: string }) {
    const newName = edits.name.trim();
    const newSlack = edits.slackUserId.trim() || null;

    // 1) Update profile role if profile exists
    if (u.profile && edits.role !== u.role) {
      await supabase.from('profiles').update({ role: edits.role }).eq('id', u.profile.id);
    }

    // 2) Determine which roster the role belongs to
    const targetRoster = rosterForRole(edits.role);

    // 3) Update / create the right roster row, and remove from the wrong one
    if (targetRoster === 'sp') {
      const spRole = edits.role as SPMember['role'];
      if (u.sp) {
        await supabase.from('sp_members').update({
          name: u.profile ? u.sp.name : newName,
          role: spRole,
          slack_user_id: newSlack,
        }).eq('id', u.sp.id);
      } else if (newSlack || !u.profile) {
        // Create an sp_members row when we have something to record (slack id)
        // or when there's no profile to anchor the person yet.
        const maxOrder = spMembers.length > 0 ? Math.max(...spMembers.map(m => m.sort_order)) + 1 : 0;
        await supabase.from('sp_members').insert({
          name: u.profile ? u.profile.full_name : newName,
          role: spRole, sort_order: maxOrder, active: true, slack_user_id: newSlack,
        });
      }
      if (u.hc) {
        await supabase.from('high_council_members').delete().eq('id', u.hc.id);
      }
    } else {
      if (u.hc) {
        await supabase.from('high_council_members').update({
          name: u.profile ? u.hc.name : newName,
          slack_user_id: newSlack,
        }).eq('id', u.hc.id);
      } else if (newSlack || !u.profile) {
        const maxOrder = hcMembers.length > 0 ? Math.max(...hcMembers.map(m => m.sort_order)) + 1 : 0;
        await supabase.from('high_council_members').insert({
          name: u.profile ? u.profile.full_name : newName,
          sort_order: maxOrder, active: true, slack_user_id: newSlack,
        });
      }
      if (u.sp) {
        await supabase.from('sp_members').delete().eq('id', u.sp.id);
      }
    }

    setEditing(null);
    await fetchAll();
  }

  async function handleRemove(u: UnifiedUser) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${t('userRoles.removeConfirm')} ${u.name}?`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(t('userRoles.removeTitle'), `${t('userRoles.removeConfirm')} ${u.name}?`, [
            { text: t('detail.cancel'), onPress: () => resolve(false) },
            { text: t('userRoles.remove'), style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    if (u.profile) await supabase.from('profiles').update({ status: 'rejected' }).eq('id', u.profile.id);
    if (u.sp) await supabase.from('sp_members').delete().eq('id', u.sp.id);
    if (u.hc) await supabase.from('high_council_members').delete().eq('id', u.hc.id);
    setEditing(null);
    await fetchAll();
  }

  async function handleAdd(edits: { name: string; role: UserRole; slackUserId: string }) {
    const name = edits.name.trim();
    if (!name) return;
    const slack = edits.slackUserId.trim() || null;
    const targetRoster = rosterForRole(edits.role);
    if (targetRoster === 'sp') {
      const maxOrder = spMembers.length > 0 ? Math.max(...spMembers.map(m => m.sort_order)) + 1 : 0;
      await supabase.from('sp_members').insert({
        name, role: edits.role as SPMember['role'],
        sort_order: maxOrder, active: true, slack_user_id: slack,
      });
    } else {
      const maxOrder = hcMembers.length > 0 ? Math.max(...hcMembers.map(m => m.sort_order)) + 1 : 0;
      await supabase.from('high_council_members').insert({
        name, sort_order: maxOrder, active: true, slack_user_id: slack,
      });
    }
    setAdding(false);
    await fetchAll();
  }

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.lg }} />;

  return (
    <>
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.gray[400]} style={{ marginRight: 6 }} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder={t('userRoles.searchPlaceholder')}
            placeholderTextColor={Colors.gray[400]}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={16} color={Colors.white} />
          <Text style={styles.addBtnText}>{t('userRoles.add')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countLine}>{unified.length} {t('userRoles.peopleCount')}</Text>

      <View style={styles.tableCard}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{t('userRoles.noUsers')}</Text>
        ) : filtered.map((u, i) => (
          <View key={u.key} style={[styles.userRow, i === filtered.length - 1 && styles.userRowLast]}>
            <View style={{ flex: 1.4, minWidth: 0 }}>
              <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
              <Text style={styles.userSub} numberOfLines={1}>{u.email ?? '—'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userRole} numberOfLines={1}>{ROLE_LABELS[u.role]}</Text>
              <Text style={styles.userSlack} numberOfLines={1}>
                {u.slackUserId ? `@${u.slackUserId}` : '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setEditing(u)} style={styles.editIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="create-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {editing && (
        <EditUserSheet
          user={editing}
          onCancel={() => setEditing(null)}
          onSave={(e) => handleSave(editing, e)}
          onRemove={() => handleRemove(editing)}
        />
      )}

      {adding && (
        <EditUserSheet
          user={null}
          onCancel={() => setAdding(false)}
          onSave={(e) => handleAdd(e)}
        />
      )}
    </>
  );
}

// ─── Edit user sheet (modal) ──────────────────────────────────────────────────

interface EditSheetProps {
  user: UnifiedUser | null;
  onCancel: () => void;
  onSave: (edits: { name: string; role: UserRole; slackUserId: string }) => void;
  onRemove?: () => void;
}

function EditUserSheet({ user, onCancel, onSave, onRemove }: EditSheetProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'high_councilor');
  const [slackUserId, setSlackUserId] = useState(user?.slackUserId ?? '');
  const [saving, setSaving] = useState(false);

  const nameLocked = !!user?.profile;

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name, role, slackUserId });
    setSaving(false);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{user ? t('userRoles.editUser') : t('userRoles.addUser')}</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('userRoles.fieldName')}</Text>
            {nameLocked ? (
              <View style={styles.fieldRO}><Text style={styles.fieldROText}>{name}</Text></View>
            ) : (
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder={t('userRoles.namePlaceholder')}
                placeholderTextColor={Colors.gray[400]}
                autoCapitalize="words"
              />
            )}
          </View>

          {user?.email && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('userRoles.fieldEmail')}</Text>
              <View style={styles.fieldRO}><Text style={styles.fieldROText}>{user.email}</Text></View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('userRoles.fieldRole')}</Text>
            <View style={styles.roleChipRow}>
              {ALL_ROLES.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('userRoles.fieldSlackId')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={slackUserId}
              onChangeText={setSlackUserId}
              placeholder={t('userRoles.slackIdPlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldHint}>{t('userRoles.slackIdHint')}</Text>
          </View>

          <View style={styles.modalActions}>
            {onRemove && (
              <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
                <Ionicons name="person-remove-outline" size={14} color={Colors.error} />
                <Text style={styles.removeBtnText}>{t('userRoles.revokeAccess')}</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <Button title={t('detail.cancel')} variant="secondary" onPress={onCancel} style={styles.modalBtn} />
            <Button
              title={user ? t('detail.save') : t('userRoles.add')}
              onPress={handleSave}
              loading={saving}
              disabled={!name.trim() || saving}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Suite Tab — 19 Gathered roles ────────────────────────────────────────────
// Writes to public.gather_user_roles on the shared Supabase project via the
// gather_grant_role / gather_revoke_role RPCs.

interface SuiteUser { user_id: string; email: string | null }
interface SuiteRoleRow { email: string; role_key: string; ward: string | null }
interface SuiteDraft { role_key: string; ward: string | null }
interface SuiteWard { id: string; name: string }

function SuiteTab() {
  const [users, setUsers] = useState<SuiteUser[]>([]);
  const [wards, setWards] = useState<SuiteWard[]>([]);
  const [roleRows, setRoleRows] = useState<SuiteRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SuiteUser | null>(null);
  const [draft, setDraft] = useState<SuiteDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const [usersRes, wardsRes, rolesRes] = await Promise.all([
      supabase.from('gather_app_users').select('user_id, email').order('email'),
      supabase.from('wards').select('id, name').order('name'),
      supabase.from('gather_user_roles').select('email, role_key, ward').is('revoked_at', null),
    ]);
    setUsers((usersRes.data ?? []) as SuiteUser[]);
    setWards((wardsRes.data ?? []) as SuiteWard[]);
    setRoleRows((rolesRes.data ?? []) as SuiteRoleRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const rolesByEmail: Record<string, SuiteRoleRow[]> = {};
  for (const r of roleRows) {
    const key = r.email.toLowerCase();
    if (!rolesByEmail[key]) rolesByEmail[key] = [];
    rolesByEmail[key].push(r);
  }

  function openEdit(u: SuiteUser) {
    setEditing(u);
    const existing = rolesByEmail[(u.email ?? '').toLowerCase()] ?? [];
    setDraft(existing.map(r => ({ role_key: r.role_key, ward: r.ward })));
  }

  function toggleRole(roleKey: string) {
    setDraft(prev => {
      const has = prev.some(d => d.role_key === roleKey);
      if (has) return prev.filter(d => d.role_key !== roleKey);
      return [...prev, { role_key: roleKey, ward: null }];
    });
  }

  function setWardForRole(roleKey: string, ward: string | null) {
    setDraft(prev => prev.map(d => d.role_key === roleKey ? { ...d, ward } : d));
  }

  async function saveRoles() {
    if (!editing?.email) return;
    setSaving(true);
    try {
      const email = editing.email;
      const existing = rolesByEmail[email.toLowerCase()] ?? [];
      const sameKey = (a: SuiteDraft, b: SuiteDraft) =>
        a.role_key === b.role_key && (a.ward ?? null) === (b.ward ?? null);
      const toAdd = draft.filter(d => !existing.some(e => sameKey(e, d)));
      const toRemove = existing.filter(e => !draft.some(d => sameKey(e, d)));

      for (const r of toRemove) {
        const { error } = await supabase.rpc('gather_revoke_role', {
          p_email: email, p_role: r.role_key, p_ward: r.ward,
        });
        if (error) throw new Error(`Revoke ${r.role_key}: ${error.message}`);
      }
      for (const r of toAdd) {
        const { error } = await supabase.rpc('gather_grant_role', {
          p_email: email, p_role: r.role_key, p_ward: r.ward, p_full_name: null,
        });
        if (error) throw new Error(`Grant ${r.role_key}: ${error.message}`);
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = users.filter(u => !filter || (u.email ?? '').toLowerCase().includes(filter.toLowerCase()));

  if (loading) {
    return <View style={{ padding: Spacing.lg }}><ActivityIndicator /></View>;
  }

  return (
    <View>
      <Text style={{ fontSize: FontSize.xs, color: Colors.gray[500], paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
        Assign the 19 Gathered suite roles. One person can hold multiple roles. Stake roles cover the whole stake;
        ward roles need a ward picked. Writes flow to every Gathered app via the shared gather_user_roles table.
      </Text>

      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter by email…"
        style={[styles.modalInput, { marginHorizontal: Spacing.md, marginTop: Spacing.sm }]}
        placeholderTextColor={Colors.gray[400]}
      />

      {filtered.map(u => {
        const roles = rolesByEmail[(u.email ?? '').toLowerCase()] ?? [];
        return (
          <View key={u.user_id} style={styles.suiteUserRow}>
            <View style={styles.suiteUserInfo}>
              <Text style={styles.suiteUserEmail}>{u.email ?? '(no email)'}</Text>
              <View style={styles.suiteRoleBadgeRow}>
                {roles.length === 0 && (
                  <Text style={{ fontSize: 11, color: Colors.gray[400], fontStyle: 'italic' }}>No suite roles</Text>
                )}
                {roles.map(r => {
                  const def = SUITE_ROLES.find(s => s.key === r.role_key);
                  return (
                    <View key={`${r.role_key}-${r.ward ?? ''}`} style={styles.suiteRoleBadge}>
                      <Text style={styles.suiteRoleBadgeText}>
                        {def?.label ?? r.role_key}{r.ward ? ` · ${r.ward}` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <TouchableOpacity onPress={() => openEdit(u)} disabled={!u.email} style={styles.suiteEditBtn}>
              <Text style={styles.suiteEditBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 500, maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Suite roles</Text>
            <Text style={styles.modalSub}>{editing?.email}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {SUITE_ROLES.map(role => {
                const sel = draft.find(d => d.role_key === role.key);
                const selected = !!sel;
                return (
                  <View
                    key={role.key}
                    style={[styles.suiteRoleRow, selected ? styles.suiteRoleRowChecked : styles.suiteRoleRowUnchecked]}
                  >
                    <TouchableOpacity onPress={() => toggleRole(role.key)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={[styles.suiteRoleCheck, selected && styles.suiteRoleCheckOn]}>
                        {selected && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                      </View>
                      <Text style={styles.suiteRoleLabel}>{role.label}</Text>
                      <Text style={styles.suiteRoleScope}>{role.scope}</Text>
                    </TouchableOpacity>
                    {selected && role.scope === 'ward' && (
                      <View style={[styles.suiteWardPicker, { width: '100%' }]}>
                        <View style={styles.suiteWardChipRow}>
                          {wards.map(w => {
                            const isOn = sel?.ward === w.name;
                            return (
                              <TouchableOpacity
                                key={w.id}
                                onPress={() => setWardForRole(role.key, isOn ? null : w.name)}
                                style={[styles.suiteWardChip, isOn && styles.suiteWardChipOn]}
                              >
                                <Text style={[styles.suiteWardChipText, isOn && styles.suiteWardChipTextOn]}>{w.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: Spacing.md }]}>
              <Button title="Cancel" onPress={() => setEditing(null)} variant="secondary" style={styles.modalBtn} />
              <Button title={saving ? 'Saving…' : 'Save'} onPress={() => void saveRoles()} disabled={saving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[400] },
  tabTextActive: { color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },

  // Toolbar
  toolbar: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.gray[200], paddingHorizontal: Spacing.sm, height: 40,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.sm, color: Colors.black,
    paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  countLine: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.sm, marginLeft: 4 },

  // Table
  tableCard: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gray[200], overflow: 'hidden',
    ...(Shadow as any),
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  userRowLast: { borderBottomWidth: 0 },
  userName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[900] },
  userSub: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  userRole: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  userSlack: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 1 },
  editIcon: { padding: Spacing.xs },
  empty: { fontSize: FontSize.sm, color: Colors.gray[400], fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  // Modal / sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: Spacing.md },
  modalCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%',
    maxWidth: 500, alignSelf: 'center',
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: 4 },
  modalSub: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: Spacing.md },
  modalInput: {
    backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.black, marginBottom: Spacing.xs,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.md },
  modalBtn: { minWidth: 90 },

  // Edit sheet fields
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.gray[500], fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, fontSize: FontSize.sm, color: Colors.black,
  },
  fieldRO: {
    backgroundColor: Colors.gray[100], borderWidth: 1.5, borderColor: Colors.gray[100], borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  fieldROText: { fontSize: FontSize.sm, color: Colors.gray[700] },
  fieldHint: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 4 },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.gray[300], backgroundColor: Colors.white,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  roleChipText: { fontSize: FontSize.xs, color: Colors.gray[600] },
  roleChipTextActive: { color: Colors.primary, fontWeight: '700' },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.error + '10', borderWidth: 1, borderColor: Colors.error + '30',
  },
  removeBtnText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },

  // Suite tab
  suiteUserRow: {
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
  },
  suiteUserInfo: { flex: 1 },
  suiteUserEmail: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.gray[800] },
  suiteRoleBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  suiteRoleBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1, borderRadius: 4,
  },
  suiteRoleBadgeText: { fontSize: 10, color: '#3730A3' },
  suiteEditBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: Radius.sm,
  },
  suiteEditBtnText: { fontSize: FontSize.xs, color: Colors.gray[700], fontWeight: '500' },
  suiteRoleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 1, borderRadius: Radius.sm, marginBottom: 6,
  },
  suiteRoleRowChecked: { backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' },
  suiteRoleRowUnchecked: { backgroundColor: Colors.white, borderColor: Colors.gray[200] },
  suiteRoleCheck: { width: 18, height: 18, borderWidth: 1.5, borderColor: Colors.gray[400], borderRadius: 3, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  suiteRoleCheckOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  suiteRoleLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.gray[800] },
  suiteRoleScope: { fontSize: 10, color: Colors.gray[400], textTransform: 'uppercase', letterSpacing: 0.5 },
  suiteWardPicker: { marginTop: 6, paddingHorizontal: 6 },
  suiteWardChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  suiteWardChip: { paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: 4 },
  suiteWardChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  suiteWardChipText: { fontSize: 11, color: Colors.gray[700] },
  suiteWardChipTextOn: { color: Colors.white, fontWeight: '600' },
});
