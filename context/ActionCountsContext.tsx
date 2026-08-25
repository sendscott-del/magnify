import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setLocalAppBadge } from '../lib/push';
import { useAuth } from './AuthContext';
import { useDemoMode } from './DemoModeContext';

interface ActionCountsValue {
  hcCount: number;
  spCount: number;
  refresh: () => Promise<void>;
}

const ActionCountsContext = createContext<ActionCountsValue>({
  hcCount: 0,
  spCount: 0,
  refresh: async () => {},
});

// Count logic is intentionally mirrored in supabase/functions/magnify-send-action-pushes/index.ts
// (push badge fanout). Keep both in sync when stage rules change.
const HC_STAGES = ['hc_approval', 'issue_calling', 'ordained', 'sustain', 'set_apart', 'record'];

export function ActionCountsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { demoMode } = useDemoMode();
  const [hcCount, setHcCount] = useState(0);
  const [spCount, setSpCount] = useState(0);

  const refresh = useCallback(async () => {
    // Demo mode: don't surface badges — fixture data is for exploration,
    // not a real action queue for the signed-in user.
    if (demoMode || !profile?.full_name) {
      setHcCount(0);
      setSpCount(0);
      return;
    }
    const myName = profile.full_name;
    const myId = profile.id;
    const myRole = profile.role;

    const [callingsRes, hcMembersRes, hcApprovalsRes, hcWardsRes, wardSustRes, spApprovalsRes] = await Promise.all([
      supabase
        .from('callings')
        .select('id, type, ward_id, stage, extend_by, sustain_by, set_apart_by, record_by, created_by, rejected')
        .eq('rejected', false)
        .neq('stage', 'complete'),
      supabase.from('high_council_members').select('id, name').eq('active', true),
      supabase.from('hc_approvals').select('calling_id, hc_member_id, approved'),
      supabase.from('hc_member_wards').select('hc_member_id, ward_id'),
      supabase.from('ward_sustainings').select('calling_id, ward_id, sustained').eq('sustained', true),
      supabase.from('stake_presidency_approvals').select('calling_id, role, approved'),
    ]);

    const callings = (callingsRes.data ?? []) as Array<{
      id: string;
      type: 'ward_calling' | 'stake_calling' | 'mp_ordination';
      ward_id: string | null;
      stage: string;
      extend_by: string | null;
      sustain_by: string | null;
      set_apart_by: string | null;
      record_by: string | null;
      created_by: string | null;
    }>;
    // calling_id -> which SP roles have approved it
    const spApprovalMap: Record<string, { stake_president?: boolean; first_counselor?: boolean; second_counselor?: boolean }> = {};
    for (const a of (spApprovalsRes.data ?? []) as Array<{ calling_id: string; role: string; approved: boolean }>) {
      (spApprovalMap[a.calling_id] ??= {})[a.role as 'stake_president' | 'first_counselor' | 'second_counselor'] = a.approved;
    }
    const hcMembers = (hcMembersRes.data ?? []) as Array<{ id: string; name: string }>;
    const hcApprovals = (hcApprovalsRes.data ?? []) as Array<{
      calling_id: string;
      hc_member_id: string;
      approved: boolean;
    }>;
    const hcWards = (hcWardsRes.data ?? []) as Array<{ hc_member_id: string; ward_id: string }>;
    const wardSust = (wardSustRes.data ?? []) as Array<{ calling_id: string; ward_id: string }>;

    const myHcMember = hcMembers.find(m => m.name === myName);
    const approvalMap: Record<string, boolean> = {};
    hcApprovals.forEach(a => {
      approvalMap[`${a.calling_id}:${a.hc_member_id}`] = a.approved;
    });
    const myWards = new Set<string>();
    if (myHcMember) {
      for (const row of hcWards) {
        if (row.hc_member_id === myHcMember.id) myWards.add(row.ward_id);
      }
    }
    const sustainedMap: Record<string, Set<string>> = {};
    for (const row of wardSust) {
      if (!sustainedMap[row.calling_id]) sustainedMap[row.calling_id] = new Set();
      sustainedMap[row.calling_id].add(row.ward_id);
    }

    let hc = 0;
    let sp = 0;
    for (const c of callings) {
      if (HC_STAGES.includes(c.stage)) {
        // Only count the assignee for the CURRENT stage. Prior-stage
        // assignees are done — they shouldn't keep accumulating badges.
        const currentAssignee =
          c.stage === 'issue_calling' || c.stage === 'ordained' ? c.extend_by :
          c.stage === 'sustain'   ? c.sustain_by :
          c.stage === 'set_apart' ? c.set_apart_by :
          c.stage === 'record'    ? c.record_by :
          null;
        if (currentAssignee === myName) {
          hc++;
          continue;
        }
        if (c.stage === 'hc_approval' && myHcMember) {
          const key = `${c.id}:${myHcMember.id}`;
          if (!approvalMap[key]) {
            hc++;
            continue;
          }
        }
        if (c.stage === 'sustain' && myWards.size > 0) {
          if (c.type === 'stake_calling') {
            const sustained = sustainedMap[c.id] ?? new Set<string>();
            let needs = false;
            for (const wid of myWards) {
              if (!sustained.has(wid)) { needs = true; break; }
            }
            if (needs) { hc++; continue; }
          } else if (c.ward_id && myWards.has(c.ward_id)) {
            hc++;
            continue;
          }
        }
      }
      // New idea → the Stake President reviews it (only he advances Ideas).
      // Badge him for ideas he didn't submit himself; never for his own.
      if (c.stage === 'ideas') {
        if (myRole === 'stake_president' && c.created_by !== myId) sp++;
      }
      // For Approval → each SP member is "owed" until they've approved. The
      // Stake President's sign-off is last: he isn't badged until BOTH the
      // 1st and 2nd counselor have approved. Clerk/exec-sec are optional and
      // are not badged for this stage.
      else if (c.stage === 'for_approval') {
        const appr = spApprovalMap[c.id] ?? {};
        if (myRole === 'first_counselor' && !appr.first_counselor) sp++;
        else if (myRole === 'second_counselor' && !appr.second_counselor) sp++;
        else if (myRole === 'stake_president' && appr.first_counselor && appr.second_counselor && !appr.stake_president) sp++;
      }
      // Pending Interview → the presidency owes the candidate an interview.
      // Badge all three; there's no per-member record of who will hold it.
      else if (c.stage === 'pending_interview') {
        if (myRole === 'stake_president' || myRole === 'first_counselor' || myRole === 'second_counselor') sp++;
      }
    }

    setHcCount(hc);
    setSpCount(sp);
    // Mirror the total to the home-screen icon while the app is open.
    // Push events update it when the app is closed.
    setLocalAppBadge(hc + sp);
    import('../lib/nativePush').then(m => m.setNativeBadge(hc + sp)).catch(() => {});
  }, [profile?.full_name, profile?.id, profile?.role, demoMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ActionCountsContext.Provider value={{ hcCount, spCount, refresh }}>
      {children}
    </ActionCountsContext.Provider>
  );
}

export const useActionCounts = () => useContext(ActionCountsContext);
