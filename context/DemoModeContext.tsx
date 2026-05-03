import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MagnifyDemoRole =
  | 'stake_president'
  | 'first_counselor'
  | 'second_counselor'
  | 'high_councilor'
  | 'stake_clerk'
  | 'exec_secretary'
  | 'member';

export const MAGNIFY_DEMO_ROLE_LABELS: Record<MagnifyDemoRole, string> = {
  stake_president: 'Stake President',
  first_counselor: '1st Counselor',
  second_counselor: '2nd Counselor',
  high_councilor: 'High Councilor',
  stake_clerk: 'Stake Clerk',
  exec_secretary: 'Executive Secretary',
  member: 'Member',
};

interface DemoMode {
  demoMode: boolean;
  demoRole: MagnifyDemoRole;
  loaded: boolean;
  setDemoMode: (on: boolean) => void;
  setDemoRole: (role: MagnifyDemoRole) => void;
}

const Ctx = createContext<DemoMode | null>(null);
const KEY_MODE = 'magnify.demoMode';
const KEY_ROLE = 'magnify.demoRole';

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState(false);
  const [demoRole, setDemoRoleState] = useState<MagnifyDemoRole>('stake_president');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const m = await AsyncStorage.getItem(KEY_MODE);
      if (m === 'on') setDemoModeState(true);
      const r = (await AsyncStorage.getItem(KEY_ROLE)) as MagnifyDemoRole | null;
      if (r && r in MAGNIFY_DEMO_ROLE_LABELS) setDemoRoleState(r);
      setLoaded(true);
    })();
  }, []);

  const setDemoMode = useCallback(async (on: boolean) => {
    setDemoModeState(on);
    await AsyncStorage.setItem(KEY_MODE, on ? 'on' : 'off');
  }, []);

  const setDemoRole = useCallback(async (role: MagnifyDemoRole) => {
    setDemoRoleState(role);
    await AsyncStorage.setItem(KEY_ROLE, role);
  }, []);

  return (
    <Ctx.Provider value={{ demoMode, demoRole, loaded, setDemoMode, setDemoRole }}>{children}</Ctx.Provider>
  );
}

export function useDemoMode(): DemoMode {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDemoMode must be used inside <DemoModeProvider>');
  return ctx;
}
