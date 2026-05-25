import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Colors, Radius, FontSize, Spacing } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useActionCounts } from '../context/ActionCountsContext';
import { ProductIcon, ProductIconKind } from '../components/icons/ProductIcon';
import { AppSwitcher } from '../components/AppSwitcher';
import { DemoModeBanner } from '../components/DemoModeBanner';
import { SuggestionFAB } from '../components/ui/SuggestionFAB';

/**
 * Desktop web shell — 224px navy sidebar + content. Renders only at md+
 * (≥ 768px) on web; native and phone-width web fall through to the
 * MainTabNavigator. Mirrors the sidebar pattern Knit/Glean/Steward/Tidings
 * just adopted from Magnify's design vocabulary.
 */
export function WebShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { isPresidency, isClerk } = useAuth();
  const { hcCount, spCount } = useActionCounts();
  const showSpBoard = isPresidency || isClerk;
  const nav = useNavigation<any>();
  const routeName = useCurrentRouteName();

  // Sidebar nav lives one level above the stack, so route names from the
  // child stack ("PresidencyMain", "CallingDetail") map back to their parent
  // section here. Callers from /calling/:id stay highlighted on the board
  // that owns that detail screen.
  function activeFor(section: 'New' | 'PresidencyBoard' | 'HC' | 'Completed' | 'Settings'): boolean {
    if (!routeName) return false;
    if (section === 'PresidencyBoard') return routeName === 'PresidencyMain';
    if (section === 'HC') return routeName === 'HCMain' || routeName === 'CallingDetail';
    if (section === 'Completed') return routeName === 'CompletedList';
    if (section === 'Settings') {
      return [
        'SettingsMain',
        'Help',
        'ReleaseNotes',
        'PendingAccess',
        'SlackSettings',
      ].includes(routeName);
    }
    return routeName === section;
  }

  // WebShell sits inside the outer Auth Stack's <Stack.Screen name="Main">.
  // useNavigation() therefore returns the Auth-stack nav, which only knows
  // about "Main". To reach screens inside WebStackNavigator we have to use
  // React Navigation's nested-navigate syntax, where the parent receives a
  // { screen: <innerScreenName> } payload and forwards it to the inner stack.
  function goto(screen: string) {
    (nav as any).navigate('Main', { screen });
  }

  return (
    <View style={styles.root}>
      <DemoModeBanner />
      <AppSwitcher />
      <View style={styles.row}>
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Ionicons name="trending-up" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.brandWord}>Magnify</Text>
          </View>

          <ScrollView style={styles.nav}>
            <SideLink
              label={t('nav.new')}
              ionicon="add-circle"
              active={activeFor('New')}
              onPress={() => goto('New')}
            />
            {showSpBoard && (
              <SideLink
                label={t('nav.spBoard')}
                productIcon="sp_board"
                badge={spCount > 0 ? spCount : undefined}
                active={activeFor('PresidencyBoard')}
                onPress={() => goto('PresidencyBoard')}
              />
            )}
            <SideLink
              label={t('nav.hcBoard')}
              productIcon="hc_board"
              badge={hcCount > 0 ? hcCount : undefined}
              active={activeFor('HC')}
              onPress={() => goto('HC')}
            />
            <SideLink
              label={t('nav.completed')}
              ionicon="checkmark-done"
              active={activeFor('Completed')}
              onPress={() => goto('Completed')}
            />
            <SideLink
              label={t('nav.settings')}
              ionicon="settings-outline"
              active={activeFor('Settings')}
              onPress={() => goto('Settings')}
            />
          </ScrollView>

          <View style={styles.footerNav}>
            <View style={styles.footerDivider} />
            <SideLink
              label={t('settings.userGuide')}
              ionicon="book-outline"
              small
              onPress={() => goto('Help')}
            />
            <SideLink
              label={t('settings.releaseNotes')}
              ionicon="sparkles-outline"
              small
              onPress={() => goto('ReleaseNotes')}
            />
          </View>
        </View>

        <View style={styles.content}>{children}</View>
      </View>
      <SuggestionFAB />
    </View>
  );
}

interface SideLinkProps {
  label: string;
  ionicon?: keyof typeof Ionicons.glyphMap;
  productIcon?: ProductIconKind;
  active?: boolean;
  badge?: number;
  small?: boolean;
  onPress: () => void;
}

function SideLink({
  label, ionicon, productIcon, active, badge, small, onPress,
}: SideLinkProps) {
  // Spec pitfall (m2): "Gold is reserved for the brand mark and the FAB."
  // Active state is full-white text on white-translucent fill (set by
  // linkActive), inactive is dimmed white. Matches Knit/Glean/Steward/
  // Tidings sidebars pixel-for-pixel.
  const color = active ? 'white' : 'rgba(255,255,255,0.75)';
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.link,
        small && styles.linkSmall,
        active && styles.linkActive,
        hovered && !active && styles.linkHover,
      ]}
    >
      <View style={styles.linkIcon}>
        {productIcon ? (
          <ProductIcon kind={productIcon} size={small ? 18 : 22} />
        ) : ionicon ? (
          <Ionicons name={ionicon} size={small ? 14 : 16} color={color} />
        ) : null}
      </View>
      <Text style={[styles.linkLabel, small && styles.linkLabelSmall, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {badge != null && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Walk react-navigation's state to find the deepest current route name —
 *  Tab/Stack containers nest, and useRoute() inside WebShell only sees the
 *  outermost. Returns null if state isn't ready yet. */
function useCurrentRouteName(): string | null {
  return useNavigationState((state) => {
    if (!state) return null;
    let s: any = state;
    while (s?.routes && typeof s.index === 'number') {
      const route = s.routes[s.index];
      if (!route?.state) return route?.name ?? null;
      s = route.state;
    }
    return null;
  });
}

const SIDEBAR_WIDTH = 224;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    flexDirection: 'column',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: Spacing.md,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWord: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: FontSize.lg,
    letterSpacing: -0.3,
  },
  nav: { flex: 1 },
  footerNav: {
    paddingTop: Spacing.xs,
  },
  footerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 6,
    marginBottom: Spacing.xs,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 2,
    borderRadius: Radius.sm,
  },
  linkSmall: {
    paddingVertical: 6,
  },
  linkActive: {
    // White-on-white-translucent active fill — matches the suite recipe.
    // Earlier gold fill (rgba(201,168,76,0.18)) violated the spec pitfall
    // that gold belongs to the brand mark + FAB only.
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  linkHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  linkIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  linkLabelSmall: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    minWidth: 0,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto' } as object)
      : {}),
  },
});
