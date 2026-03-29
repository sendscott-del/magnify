import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { CHANGELOG } from '../../constants/changelog';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';

export function ReleaseNotesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Release Notes</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {CHANGELOG.map((entry) => (
          <View key={entry.version} style={styles.section}>
            <View style={styles.versionRow}>
              <Text style={styles.version}>v{entry.version}</Text>
              <Text style={styles.date}>{entry.date}</Text>
            </View>

            {entry.enhancements.length > 0 && (
              <>
                <Text style={styles.categoryLabel}>Enhancements</Text>
                {entry.enhancements.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletGreen}>+</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </>
            )}

            {entry.bugFixes.length > 0 && (
              <>
                <Text style={[styles.categoryLabel, { marginTop: Spacing.sm }]}>Bug Fixes</Text>
                {entry.bugFixes.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletRed}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        ))}

        <Text style={styles.footer}>Release notes are generated automatically on each deployment.</Text>
        <DisclaimerFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  backBtn: { padding: 4 },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  version: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },
  date: {
    fontSize: FontSize.sm,
    color: Colors.gray[400],
  },
  categoryLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  bulletGreen: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.success,
    width: 12,
  },
  bulletRed: {
    fontSize: FontSize.md,
    color: Colors.error,
    width: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.gray[700],
    lineHeight: 18,
  },
  footer: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
});
