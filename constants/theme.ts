import { Platform } from 'react-native';

export const Colors = {
  primary: '#1B3A6B',
  primaryLight: '#2A5298',
  primaryDark: '#0F2347',
  primaryFade: '#E8EEF8',
  accent: '#C9A84C',
  accentLight: '#FFF8E7',
  white: '#FFFFFF',
  black: '#111111',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  stage: {
    ideas: '#6B7280',
    for_approval: '#F59E0B',
    stake_approved: '#3B82F6',
    hc_approval: '#8B5CF6',
    issue_calling: '#EC4899',
    ordained: '#EC4899',
    sustain: '#14B8A6',
    set_apart: '#22C55E',
    record: '#F97316',
    complete: '#10B981',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const Shadow = Platform.OS === 'web'
  ? { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
  : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    };
