// Native (iOS/Android) push registration via expo-notifications + the Expo
// Push API. Web/PWA push lives in lib/push.ts (Web Push / VAPID) — this file
// is the native counterpart, storing Expo push tokens in
// magnify_native_push_tokens for the magnify-send-action-pushes edge fn.
//
// IMPORTANT — the OTA fleet problem this guards against:
// One JS bundle (runtime pinned 1.0.0) is served to EVERY iOS binary, including
// the 2-month-old App Store build (build 7) that has NO expo-notifications
// native module and no aps-environment entitlement. On such a binary, merely
// `require('expo-notifications')` does NOT throw — the JS resolves — but the
// module wires up a native NotificationsEmitter at import, which HARD-CRASHES
// on a real device (uncatchable in JS; it looked fine in the simulator, which
// is why this shipped and took down the fleet on 2026-08-08).
//
// The only safe gate is to ask expo-modules-core whether the NATIVE module is
// registered BEFORE touching expo-notifications at all. requireOptionalNative
// Module returns null instead of throwing when absent, and expo-modules-core
// IS present in every build. If the native module isn't there, we never import
// expo-notifications — the binary behaves exactly as it did before push
// existed. Native push therefore only ever runs on build 13+.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

let _cached: any | null | undefined;
function loadNotifications(): any | null {
  if (Platform.OS === 'web') return null;
  if (_cached !== undefined) return _cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo-modules-core');
    // Present only in binaries actually built with expo-notifications.
    const native = requireOptionalNativeModule?.('ExpoPushTokenManager');
    if (!native) { _cached = null; return null; }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _cached = require('expo-notifications');
  } catch {
    _cached = null;
  }
  return _cached;
}

/** Ask permission (first call shows the OS prompt), fetch the Expo push
 *  token, and store it for this user. Safe to call on every sign-in. */
export async function registerNativePush(userId: string): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    let isDevice = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      isDevice = require('expo-device').isDevice;
    } catch { /* expo-device missing in old binaries — assume device */ }
    if (!isDevice) return; // simulators can't receive APNs pushes

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;

    await supabase.from('magnify_native_push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
  } catch (e) {
    console.warn('[nativePush] registration failed:', e);
  }
}

/** Mirror the in-app action count onto the home-screen icon badge. */
export async function setNativeBadge(count: number): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch { /* badge unsupported on this launcher — fine */ }
}

/** Show foreground notifications as banners (default is silent-drop). */
export function configureForegroundNotifications(): void {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
  } catch { /* ignore */ }
}
