import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';

/**
 * Back-mode header for every dashboard drill-down. The whole cluster is the
 * back target, not just the chevron — a 22px glyph is not a 44px tap target,
 * and these screens get used one-handed between meetings.
 */
export function DrillHeader({
  title, subtitle, onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  return (
    <View style={[styles.header, !isDesktopWeb && { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.cluster} onPress={onBack} activeOpacity={0.8} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={Colors.gray[800]} />
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  sub: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 1,
  },
});
