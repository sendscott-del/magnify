import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';

/**
 * Single source of truth for "are we on desktop web?" — used by WebShell,
 * the responsive kanban, the calling-detail right-rail, and the
 * SuggestionFAB. Subscribes to Dimensions so the layout updates live when a
 * user hot-resizes their browser between phone and desktop widths.
 */
export const MD_BREAKPOINT = 768;
export const XL_BREAKPOINT = 1280;

export function useDeviceWidth(): number {
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWidth(window.width);
    });
    return () => sub.remove();
  }, []);
  return width;
}

/** True only when the app is rendered through Expo Web at ≥ 768 px. Native
 *  builds always return false; a phone-width browser tab returns false too. */
export function useIsDesktopWeb(): boolean {
  const width = useDeviceWidth();
  return Platform.OS === 'web' && width >= MD_BREAKPOINT;
}
