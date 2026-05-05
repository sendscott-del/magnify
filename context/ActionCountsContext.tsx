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

    const [callingsRes, hcMembersRes, hcApprovalsRes] = await Promise.all([
      supabase
        .from('callings')
        .select('id, stage, extend_by, sustain_by, set_apart_by, record_by, rejected')
        .eq('rejected', false)
        .neq('stage', 'complete'),
      supabase.from('high_council_members').select('id, name').eq('active', true),
      supabase.from('hc_approvals').select('calling_id, hc_member_id, approved'),
    ]);

    const callings = (callingsRes.data ?? []) as Array<{
      id: string;
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

    const myHcMember = hcMembers.find(m => m.name === myName);
    const approvalMap: Record<string, boolean> = {};
    hcApprovals.forEach(a => {
      approvalMap[`${a.calling_id}:${a.hc_member_id}`] = a.approved;
    });

    let hc = 0;
    let sp = 0;
    for (const c of callings) {
      if (HC_STAGES.includes(c.stage)) {
        const namedAssignee = [c.extend_by, c.sustain_by, c.set_apart_by, c.record_by].includes(myName);
        if (namedAssignee) {
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
