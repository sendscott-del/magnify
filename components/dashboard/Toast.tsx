import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius } from '../../constants/theme';

interface Props {
  message: string;
  /** Undo label; omit for a confirmation with no action. */
  undoLabel?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  /** Lifted above the bottom tab bar on phone; 0 inside the desktop shell. */
  bottomOffset?: number;
  durationMs?: number;
}

/**
 * The undo toast. Zone 1 marks an item done immediately rather than asking
 * "are you sure" — this is what makes that safe, so its 5s window is the
 * confirmation step and must not be shortened.
 */
export function Toast({
  message, undoLabel, onUndo, onDismiss, bottomOffset = 0, durationMs = 5000,
}: Props) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
    // A new message restarts the timer; that's intended — the most recent
    // action is the one the undo applies to.
  }, [message, durationMs, onDismiss, anim]);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          bottom: insets.bottom + bottomOffset + 16,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {!!undoLabel && !!onUndo && (
        <TouchableOpacity onPress={onUndo} activeOpacity={0.8} hitSlop={10}>
          <Text style={styles.undo}>{undoLabel.toUpperCase()}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.gray[800],
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 8,
        }),
  },
  message: {
    flex: 1,
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  undo: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
