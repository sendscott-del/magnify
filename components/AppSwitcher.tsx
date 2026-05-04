import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors, FontSize, Spacing, Radius } from '../constants/theme';

interface AppInfo {
  name: string;
  label: string;
  url: string;
  color: string;
  blurb: string;
}

// Canonical Gather suite catalog. Mirror this list across all five apps.
const APP_CATALOG: AppInfo[] = [
  { name: 'magnify', label: 'Magnify', url: 'https://magnify-sendscott-dels-projects.vercel.app', color: '#1B3A6B', blurb: 'Calling administration' },
  { name: 'steward', label: 'Steward', url: 'https://stewards-indeed.vercel.app',                color: '#2563EB', blurb: 'Leader standard work' },
  { name: 'glean',   label: 'Glean',   url: 'https://glean-blue.vercel.app',                     color: '#C9A84C', blurb: 'Welfare & self-reliance' },
  { name: 'tidings', label: 'Tidings', url: 'https://tidings-sendscott-dels-projects.vercel.app', color: '#F59E0B', blurb: 'Two-way SMS' },
  { name: 'knit',    label: 'Knit',    url: 'https://knit-together.vercel.app',                   color: '#E11D48', blurb: 'Fellowship matching' },
];

const CURRENT_APP = 'magnify';

function AppMark({ app, size }: { app: AppInfo; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        backgroundColor: app.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '800', fontSize: size * 0.5 }}>{app.label[0]}</Text>
    </View>
  );
}

export function AppSwitcher() {
  const { user } = useAuth();
  const [otherApps, setOtherApps] = useState<AppInfo[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_apps')
      .select('app_name')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return;
        const appNames = data.map(r => r.app_name);
        const others = APP_CATALOG.filter(a => a.name !== CURRENT_APP && appNames.includes(a.name));
        setOtherApps(others);
      });
  }, [user]);

  if (otherApps.length === 0) return null;

  function openApp(url: string) {
    if (Platform.OS === 'web') {
      // Same-tab navigation so the user doesn't accumulate one tab per
      // app they hop between. The other apps live on their own domains
      // so this is a full page load, but it replaces rather than stacks.
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
    setExpanded(false);
  }

  const currentApp = APP_CATALOG.find(a => a.name === CURRENT_APP)!;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.bar} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.leftGroup}>
          <Text style={styles.lflLabel}>Gathered</Text>
          <View style={styles.divider} />
          <AppMark app={currentApp} size={18} />
          <Text style={styles.currentLabel}>{currentApp.label}</Text>
        </View>
        <View style={styles.rightGroup}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.dropdown}>
          <Text style={styles.switchLabel}>Switch to</Text>
          {otherApps.map(app => (
            <TouchableOpacity key={app.name} style={styles.appRow} onPress={() => openApp(app.url)} activeOpacity={0.7}>
              <AppMark app={app} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.appName}>{app.label}</Text>
                <Text style={styles.appBlurb}>{app.blurb}</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={Colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.switcherChrome,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lflLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  currentLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdown: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    paddingVertical: Spacing.xs,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  appName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[800],
  },
  appBlurb: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 2,
  },
});
