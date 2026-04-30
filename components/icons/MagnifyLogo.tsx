import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  size?: number;
  variant?: 'mark' | 'inverse';
  style?: ViewStyle;
}

export function MagnifyLogo({ size = 44, variant = 'mark', style }: Props) {
  const isInverse = variant === 'inverse';
  const containerColor = isInverse ? Colors.white : Colors.primary;
  const strokeColor = isInverse ? Colors.primary : Colors.white;
  const accent = Colors.accent;

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
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64" fill="none">
        <Path
          d="M11 50 L11 14 L32 38 L53 14 L53 50"
          stroke={strokeColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={44} cy={26} r={6.5} stroke={accent} strokeWidth={3.5} fill="none" />
        <Line
          x1={48.6}
          y1={30.6}
          x2={52.5}
          y2={34.5}
          stroke={accent}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
