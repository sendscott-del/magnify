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
const SP_ACTION_STAGES = ['for_approval'];

export function ActionCountsProvider({ children }: { children: React.ReactNode }) {
  const { profile, isPresidency, isClerk } = useAuth();
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

    const [callingsRes, hcMembersRes, hcApprovalsRes, hcWardsRes, wardSustRes] = await Promise.all([
      supabase
        .from('callings')
        .select('id, type, ward_id, stage, extend_by, sustain_by, set_apart_by, record_by, rejected')
        .eq('rejected', false)
        .neq('stage', 'complete'),
      supabase.from('high_council_members').select('id, name').eq('active', true),
      supabase.from('hc_approvals').select('calling_id, hc_member_id, approved'),
      supabase.from('hc_member_wards').select('hc_member_id, ward_id'),
      supabase.from('ward_sustainings').select('calling_id, ward_id, sustained').eq('sustained', true),
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
    }>;
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
      if (SP_ACTION_STAGES.includes(c.stage) && (isPresidency || isClerk)) {
        sp++;
      }
    }

    setHcCount(hc);
    setSpCount(sp);
    // Mirror the total to the home-screen icon while the app is open.
    // Push events update it when the app is closed.
    setLocalAppBadge(hc + sp);
    import('../lib/nativePush').then(m => m.setNativeBadge(hc + sp)).catch(() => {});
  }, [profile?.full_name, isPresidency, isClerk, demoMode]);

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
