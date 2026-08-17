import React, { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, View, Platform } from 'react-native';
import { useKeyboardInset, useScrollFocusedFieldIntoView } from '../../lib/useKeyboardInset';

/**
 * Drop-in `ScrollView` that keeps its fields clear of the on-screen keyboard.
 *
 * Use this instead of a bare `ScrollView` for any scroll view containing text
 * input. See `lib/useKeyboardInset` for why the react-native-web build cannot
 * rely on `KeyboardAvoidingView`.
 *
 * The extra room is a trailing spacer rather than `paddingBottom` on
 * `contentContainerStyle`: a longhand `paddingBottom` would override the
 * `padding` shorthand most of these screens already use and silently drop their
 * horizontal and top padding.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView({ children, ...props }, ref) {
    const inset = useKeyboardInset();
    useScrollFocusedFieldIntoView(inset);

    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        // Native iOS handles this itself; Android does it via adjustResize.
        {...(Platform.OS === 'ios' ? { automaticallyAdjustKeyboardInsets: true } : null)}
        {...props}
      >
        {children}
        {inset > 0 ? <View style={{ height: inset }} /> : null}
      </ScrollView>
    );
  }
);
