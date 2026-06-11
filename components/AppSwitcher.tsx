import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors, FontSize, Spacing } from '../constants/theme';

interface AppInfo {
  name: string;
  label: string;
  url: string;
  color: string;
  blurb: string;
}

// Canonical Gather suite catalog. Mirror this list across all five apps.
const APP_CATALOG: AppInfo[] = [
  { name: 'magnify', label: 'Magnify', url: 'https://magnify.gatheredin.app', color: '#1B3A6B', blurb: 'Calling administration' },
  { name: 'steward', label: 'Steward', url: 'https://steward.gatheredin.app', color: '#2563EB', blurb: 'Leader standard work' },
  { name: 'glean',   label: 'Glean',   url: 'https://glean.gatheredin.app',   color: '#C9A84C', blurb: 'Welfare & self-reliance' },
  { name: 'tidings', label: 'Tidings', url: 'https://tidings.gatheredin.app', color: '#F59E0B', blurb: 'Two-way SMS' },
  { name: 'knit',    label: 'Knit',    url: 'https://knit.gatheredin.app',    color: '#E11D48', blurb: 'Fellowship matching' },
  { name: 'conduct', label: 'Conduct', url: 'https://conduct.gatheredin.app', color: '#0D9488', blurb: 'Meeting agendas' },
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
  const { language, setLanguage, t } = useLanguage();
  const [otherApps, setOtherApps] = useState<AppInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

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
  const hasOtherApps = otherApps.length > 0;
  const scripture = t('app.scripture');
  const scriptureRef = t('app.scriptureRef');

  return (
    <View style={styles.container}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.leftGroup}
          onPress={() => hasOtherApps && setExpanded(!expanded)}
          activeOpacity={hasOtherApps ? 0.7 : 1}
        >
          <Text style={styles.lflLabel}>Gathered</Text>
          <View style={styles.divider} />
          <AppMark app={currentApp} size={18} />
          <Text style={styles.currentLabel}>{currentApp.label}</Text>
          {hasOtherApps && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="rgba(255,255,255,0.7)"
              style={{ marginLeft: 4 }}
            />
          )}
        </TouchableOpacity>
        <View style={styles.langGroup}>
          <TouchableOpacity
            onPress={() => setLanguage('en')}
            hitSlop={8}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel="English"
          >
            <Text style={[styles.langText, language === 'en' && styles.langActive]}>EN</Text>
          </TouchableOpacity>
          <Text style={styles.langDivider}>|</Text>
          <TouchableOpacity
            onPress={() => setLanguage('es')}
            hitSlop={8}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel="Español"
          >
            <Text style={[styles.langText, language === 'es' && styles.langActive]}>ES</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Per-app brand stripe — the navy the Gathered "M" chip uses, matching
          the 3px stripe the other suite apps show under the chrome. */}
      <View style={styles.brandStripe} />

      {/* Slim scripture sub-row mirrors the pattern used by Steward — a quiet
          tagline under the app chrome so the app's namesake verse rides with
          you across every screen. */}
      {scripture !== 'app.scripture' && (
        <View style={styles.scriptureRow}>
          <Text style={styles.scriptureText} numberOfLines={1}>
            <Text style={styles.scriptureQuote}>&ldquo;{scripture}&rdquo;</Text>
            {scriptureRef !== 'app.scriptureRef' && (
              <Text style={styles.scriptureRef}>  {scriptureRef}</Text>
            )}
          </Text>
        </View>
      )}

      {expanded && hasOtherApps && (
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
    flexShrink: 1,
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
  langGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
  langActive: {
    color: Colors.white,
  },
  langDivider: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
  },
  brandStripe: {
    height: 3,
    backgroundColor: Colors.primary,
  },
  scriptureRow: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  scriptureText: {
    fontSize: 11,
    color: Colors.gray[500],
    textAlign: 'center',
  },
  scriptureQuote: {
    fontStyle: 'italic',
  },
  scriptureRef: {
    color: Colors.gray[400],
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
