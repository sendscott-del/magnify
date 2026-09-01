import React, { useState } from 'react';
import { View, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

interface GridProps {
  children: React.ReactNode;
  /** Smallest acceptable column width, matching the design's auto-fit minmax. */
  minColumnWidth: number;
  gap?: number;
  /** Floor on columns — the tile grid stays 2-up on a phone rather than 1-up. */
  minColumns?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * `repeat(auto-fit, minmax(N, 1fr))` for React Native.
 *
 * RN has no CSS grid, and the same component has to lay out on a phone and on
 * full-width desktop web. Measuring the container beats branching on a
 * breakpoint: the tiles reflow correctly inside the desktop shell's content
 * column without knowing the sidebar is 224px wide.
 */
export function Grid({ children, minColumnWidth, gap = 10, minColumns = 2, style }: GridProps) {
  const [width, setWidth] = useState(0);
  const items = React.Children.toArray(children).filter(Boolean);

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  }

  const columns = width
    ? Math.max(minColumns, Math.floor((width + gap) / (minColumnWidth + gap)))
    : minColumns;
  const columnWidth = width ? (width - gap * (columns - 1)) / columns : undefined;

  return (
    <View onLayout={onLayout} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {items.map((child, i) => (
        <View key={i} style={columnWidth ? { width: columnWidth } : { flex: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
