import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { Colors, Radius } from '../../constants/theme';

export type ProductIconKind = 'ward' | 'stake' | 'mp' | 'sp_board' | 'hc_board';

interface Props {
  kind: ProductIconKind;
  size?: number;
  style?: ViewStyle;
}

// Dark navy gradient squircle from the design system preview.
// react-native-svg supports gradients but for simplicity the squircle
// is a solid Colors.primaryDark — visually close, much simpler.
export function ProductIcon({ kind, size = 40, style }: Props) {
  const glyphSize = size * 0.7;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Radius.md,
          backgroundColor: Colors.primaryDark,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Svg width={glyphSize} height={glyphSize} viewBox="0 0 36 36" fill="none">
        {kind === 'ward' && <WardGlyph />}
        {kind === 'stake' && <StakeGlyph />}
        {kind === 'mp' && <MpGlyph />}
        {kind === 'sp_board' && <SpBoardGlyph />}
        {kind === 'hc_board' && <HcBoardGlyph />}
      </Svg>
    </View>
  );
}

const W = Colors.white;
const G = Colors.accent;

function WardGlyph() {
  return (
    <>
      <Line x1={18} y1={4} x2={18} y2={11} stroke={G} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={18} cy={3.6} r={1.1} fill={G} />
      <Path d="M5 17 L18 8 L31 17" stroke={W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 17 V29 H28 V17" stroke={W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 29 V22 a3 3 0 0 1 6 0 V29" stroke={W} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function StakeGlyph() {
  return (
    <>
      <Line x1={18} y1={2} x2={18} y2={13} stroke={G} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={18} cy={1.8} r={1.2} fill={G} />
      <Path d="M3 18 L18 9 L33 18" stroke={W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 18 V30 H31 V18" stroke={W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 30 V24 a1.6 1.6 0 0 1 3.2 0 V30" stroke={W} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23.8 30 V24 a1.6 1.6 0 0 1 3.2 0 V30" stroke={W} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 30 V23 a3 3 0 0 1 6 0 V30" stroke={W} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function MpGlyph() {
  return (
    <>
      <Circle cx={13} cy={13} r={6} stroke={G} strokeWidth={2.2} />
      <Circle cx={13} cy={13} r={2} fill={G} />
      <Line x1={17.2} y1={17.2} x2={29} y2={29} stroke={W} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={23} y1={23} x2={20} y2={26} stroke={W} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={26} y1={26} x2={23} y2={29} stroke={W} strokeWidth={2.2} strokeLinecap="round" />
    </>
  );
}

function SpBoardGlyph() {
  return (
    <>
      <Rect x={6} y={7} width={24} height={6} rx={1.5} stroke={W} strokeWidth={1.8} />
      <Rect x={6} y={15} width={24} height={6} rx={1.5} stroke={G} strokeWidth={2} fill={G} fillOpacity={0.22} />
      <Line x1={9} y1={18} x2={20} y2={18} stroke={G} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={6} y={23} width={24} height={6} rx={1.5} stroke={W} strokeWidth={1.8} />
    </>
  );
}

function HcBoardGlyph() {
  // 4×3 grid of dots, with two highlighted in gold
  const positions: Array<[number, number, string]> = [
    [8, 8, W], [15, 8, W], [22, 8, W], [29, 8, W],
    [8, 18, W], [15, 18, G], [22, 18, W], [29, 18, W],
    [8, 28, W], [15, 28, W], [22, 28, G], [29, 28, W],
  ];
  return (
    <>
      {positions.map(([cx, cy, fill], i) => (
        <Circle key={i} cx={cx} cy={cy} r={2} fill={fill} />
      ))}
    </>
  );
}
