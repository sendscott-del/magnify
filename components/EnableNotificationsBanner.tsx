import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, FontSize, Spacing, Radius } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { getPushState, pushSupported, subscribeToPush, type PushSupportState } from '../lib/push';

const DISMISS_KEY = 'magnify_push_banner_dismissed_v1';

function readDismissed(): boolean {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return false;
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function writeDismissed() {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
}

export function EnableNotificationsBanner() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [state, setState] = useState<PushSupportState>('unsupported');
  const [dismissed, setDismissed] = useState<boolean>(readDismissed());
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    let mounted = true;
    getPushState(profile?.id).then(s => { if (mounted) setState(s); });
    return () => { mounted = false; };
  }, [profile?.id]);

  // Hide the banner if the platform doesn't support it, the user already
  // subscribed, the user previously denied permission (Apple/browser
  // settings is the only way back from there), or the user dismissed.
  if (!pushSupported()) return null;
  if (state === 'subscribed') return null;
  if (state === 'denied') return null;
  if (dismissed) return null;

  async function enable() {
    if (!profile?.id) return;
    setWorking(true);
    const res = await subscribeToPush(profile.id);
    setWorking(false);
    if (res.ok) {
      setState('subscribed');
    } else if (res.reason === 'denied') {
      setState('denied');
    }
  }

  function later() {
    writeDismissed();
    setDismissed(true);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="notifications-outline" size={18} color={Colors.white} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('push.bannerTitle')}</Text>
        <Text style={styles.sub}>{t('push.bannerBody')}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={enable} disabled={working} style={[styles.btn, styles.btnPrimary]}>
          <Text style={styles.btnPrimaryText}>{working ? t('push.bannerEnabling') : t('push.bannerEnable')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={later} style={styles.btn}>
          <Text style={styles.btnText}>{t('push.bannerLater')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFade,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[900] },
  sub: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  btn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { fontSize: FontSize.xs, color: Colors.white, fontWeight: '700' },
  btnText: { fontSize: FontSize.xs, color: Colors.gray[600], fontWeight: '600' },
});
