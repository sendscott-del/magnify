import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  size?: number;
  variant?: 'mark' | 'inverse';
  style?: ViewStyle;
}

/**
 * Magnify brand mark. Matches the v2.18.1 home-screen / PWA icon:
 *   - rounded square in Magnify navy (Colors.primary = #1B3A6B, the
 *     Gathered "M" chip), or white in `inverse`
 *   - large gold magnifying glass centered, no letter
 *
 * The white-"M" letterform that used to live here is gone; the suite-wide
 * convention is now "brand color + per-app gold accent shape," with the
 * "Magnify" wordmark appearing as adjacent text wherever the logo is used.
 */
export function MagnifyLogo({ size = 44, variant = 'mark', style }: Props) {
  const isInverse = variant === 'inverse';
  const containerColor = isInverse ? Colors.white : Colors.primary;
  const accent = Colors.accent;
  // Scale the glyph generously so the magnifier dominates the square — the
  // same proportion the rasterized home-screen icon uses.
  const glyph = size * 0.78;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          backgroundColor: containerColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        isInverse && { borderWidth: 1, borderColor: Colors.gray[200] },
        style,
      ]}
    >
      {/* viewBox 0..64; lens centered upper-left, handle to lower-right. */}
      <Svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
        <Circle
          cx={26}
          cy={26}
          r={15}
          stroke={accent}
          strokeWidth={6}
          fill="none"
        />
        <Line
          x1={37}
          y1={37}
          x2={52}
          y2={52}
          stroke={accent}
          strokeWidth={7}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
