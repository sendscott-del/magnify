import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

// User-access management has moved out of Magnify into its own standalone
// deployment so all five Gathered apps share one place to manage suite roles,
// app access, and admin powers. Magnify is React Native, so opening that
// (web) page bounces to the system browser via Linking.openURL.
//
// The Settings menu entry calls Linking.openURL directly now, so this screen
// is unreachable in normal navigation. Kept as a safety net in case someone
// deep-links to it or has the route in nav history.
const GATHER_URL = 'https://gathered-admin-neon.vercel.app/gather';

export function UserRolesScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Linking.openURL(GATHER_URL).catch(() => {
      /* user may dismiss the browser; leave the manual link below as fallback */
    });
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={styles.title}>Opening Gather…</Text>
      <Text style={styles.body}>
        User access management now lives in the standalone Gather page. It
        opens in your browser so the same page is used from every Gathered app
        (Magnify, Steward, Glean, Tidings, Knit).
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => Linking.openURL(GATHER_URL)}
      >
        <Text style={styles.buttonText}>Open Gather ↗</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    maxWidth: 360,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  buttonText: {
    color: Colors.background,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
});
