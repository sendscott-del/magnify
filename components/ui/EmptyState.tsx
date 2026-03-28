import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'document-outline', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={Colors.gray[300]} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[500],
    marginTop: Spacing.sm,
  },
  sub: {
    fontSize: FontSize.sm,
    color: Colors.gray[400],
    marginTop: 4,
    textAlign: 'center',
  },
});
