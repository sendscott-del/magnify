import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../../constants/theme';

export function DisclaimerFooter() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        This app is not an official app from The Church of Jesus Christ of Latter-day Saints.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  text: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
