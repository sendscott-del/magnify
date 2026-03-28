import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize, Spacing } from '../../constants/theme';
import { Stage } from '../../lib/database.types';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  stage?: Stage;
}

export function Badge({ label, color, textColor, stage }: BadgeProps) {
  const bg = color ?? (stage ? (Colors.stage as Record<string, string>)[stage] : Colors.gray[400]);
  return (
    <View style={[styles.badge, { backgroundColor: bg + '22', borderColor: bg }]}>
      <Text style={[styles.text, { color: bg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});
