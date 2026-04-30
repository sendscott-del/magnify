import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Colors, FontSize, Spacing, Radius } from '../constants/theme';
import { MagnifyLogo } from './icons/MagnifyLogo';

interface AppInfo {
  name: string;
  label: string;
  url: string;
  logo: ImageSourcePropType | null; // null when rendered as a component
}

const APP_CATALOG: AppInfo[] = [
  { name: 'magnify', label: 'Magnify', url: 'https://magnify-sendscott-dels-projects.vercel.app', logo: null },
  { name: 'steward', label: 'Steward', url: 'https://stewards-indeed.vercel.app', logo: require('../assets/steward-icon.png') },
];

function AppLogo({ app, size }: { app: AppInfo; size: number }) {
  if (app.name === 'magnify') {
    return <MagnifyLogo size={size} />;
  }
  if (app.logo) {
    return <Image source={app.logo} style={{ width: size, height: size, borderRadius: Radius.sm }} />;
  }
  return null;
}

const CURRENT_APP = 'magnify';

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
      window.open(url, '_blank');
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
          <AppLogo app={currentApp} size={20} />
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
            <TouchableOpacity key={app.name} style={styles.appRow} onPress={() => openApp(app.url)}>
              <AppLogo app={app} size={28} />
              <Text style={styles.appName}>{app.label}</Text>
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
    backgroundColor: '#1e1b4b',
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
  barLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
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
  appLogo: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
  },
  appName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[800],
  },
});
