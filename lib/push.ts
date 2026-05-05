// Web Push subscription + Web App Badging helpers. Web-only — these all
// no-op on native because Magnify ships native apps via Expo, but the
// home-screen-badge feature is currently web/PWA only.

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from '../constants/push';

export type PushSupportState =
  | 'unsupported'        // Browser lacks SW/Push/Notification — give up
  | 'denied'             // User previously blocked notifications
  | 'default'            // Permission not yet asked
  | 'granted-no-sub'     // Permission granted but no subscription stored
  | 'subscribed';        // Permission granted AND we have a sub on file

export function pushSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushState(userId: string | undefined): Promise<PushSupportState> {
  if (!pushSupported()) return 'unsupported';
  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  if (perm === 'default') return 'default';
  // Permission is 'granted' — check whether we have a subscription stored.
  if (!userId) return 'granted-no-sub';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return 'granted-no-sub';
  const { data } = await supabase
    .from('magnify_push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', sub.endpoint)
    .maybeSingle();
  return data ? 'subscribed' : 'granted-no-sub';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function subscribeToPush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: perm };

  // Make sure the SW is registered + active before we ask it for a sub.
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js');
  }
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const p256dh = (json.keys as { p256dh?: string } | undefined)?.p256dh
    ?? bufToB64(sub.getKey('p256dh'));
  const auth = (json.keys as { auth?: string } | undefined)?.auth
    ?? bufToB64(sub.getKey('auth'));

  const { error } = await supabase
    .from('magnify_push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
  if (error) {
    console.warn('[push] failed to persist subscription', error);
    return { ok: false, reason: 'db-error' };
  }
  return { ok: true };
}

// In-session badge: keep the icon in sync with the count while the app is
// open, even before a push round-trips. setAppBadge requires a secure
// origin and (on iOS) an installed PWA.
export async function setLocalAppBadge(count: number): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined') return;
  try {
    if (count > 0 && 'setAppBadge' in navigator) {
      await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
    } else if ('clearAppBadge' in navigator) {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
    }
  } catch {
    // Browser doesn't support badging — silently ignore. The in-app
    // tab badge still works.
  }
}
