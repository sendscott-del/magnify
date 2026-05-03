import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDemoMode, MAGNIFY_DEMO_ROLE_LABELS, type MagnifyDemoRole } from '../context/DemoModeContext';

const ROLES = Object.keys(MAGNIFY_DEMO_ROLE_LABELS) as MagnifyDemoRole[];

/**
 * Banner shown above the Gather AppSwitcher whenever demo mode is on.
 * The role chip cycles through every leadership and member role on tap so
 * the demoer can talk through what each role experiences without exposing
 * real ward data.
 */
export function DemoModeBanner() {
  const { demoMode, demoRole, setDemoRole, setDemoMode } = useDemoMode();
  if (!demoMode) return null;

  const idx = ROLES.indexOf(demoRole);
  const next = ROLES[(idx + 1) % ROLES.length];

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.label}>DEMO MODE</Text>
      <Pressable onPress={() => setDemoRole(next)} style={styles.rolePill} hitSlop={8}>
        <Text style={styles.roleText}>Viewing as: {MAGNIFY_DEMO_ROLE_LABELS[demoRole]}</Text>
        <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
      </Pressable>
      <TouchableOpacity onPress={() => setDemoMode(false)} style={styles.exitBtn} hitSlop={8}>
        <Text style={styles.exitText}>EXIT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#92400E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 6,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  exitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 6,
  },
  exitText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
