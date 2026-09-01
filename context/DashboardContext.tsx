import React, { createContext, useContext } from 'react';
import { DashboardData, useDashboardData } from '../lib/useDashboardData';

/**
 * One dashboard fetch for the whole app.
 *
 * The dashboard home, the tile drill-downs, the standard-work screen, the
 * review queue and the metrics history all read the same payload. Calling the
 * hook per screen would refetch eleven queries on every navigation, and worse,
 * a drill-down could disagree with the tile that opened it. The provider makes
 * the tile and its list the same data by construction.
 */
const DashboardContext = createContext<DashboardData | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const data = useDashboardData();
  return <DashboardContext.Provider value={data}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardData {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used inside DashboardProvider');
  return value;
}
