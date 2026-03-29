import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export function DisclaimerFooter() {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('app.disclaimer')}</Text>
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
