import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing } from '../../constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  transparent?: boolean;
}

export function ScreenHeader({ title, subtitle, onBack, rightElement, transparent }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + Spacing.sm },
      transparent ? styles.transparent : styles.solid,
    ]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={transparent ? Colors.white : Colors.gray[800]}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, transparent && styles.titleLight]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, transparent && styles.subtitleLight]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.rightContainer}>
          {rightElement ?? <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  solid: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  transparent: {
    backgroundColor: Colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
  },
  placeholder: {
    width: 36,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  rightContainer: {
    width: 36,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[900],
  },
  titleLight: {
    color: Colors.white,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginTop: 1,
  },
  subtitleLight: {
    color: 'rgba(255,255,255,0.7)',
  },
});
