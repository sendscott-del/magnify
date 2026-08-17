import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard avoidance for the web/PWA build.
 *
 * react-native-web does NOT implement the keyboard APIs the native side relies
 * on: its `Keyboard` module is a stub whose `addListener` never fires and whose
 * `isVisible()` always returns false, and `KeyboardAvoidingView` renders a plain
 * `View` with an empty `onKeyboardChange`. So on the PWA every screen — including
 * the auth screens that *look* protected because they wrap themselves in a
 * `KeyboardAvoidingView` — is completely unaware that the on-screen keyboard is
 * covering the bottom of the viewport. Fields near the bottom of a form end up
 * underneath it and the ScrollView is already at its end, so there is nothing
 * left to scroll.
 *
 * The VisualViewport API is the one signal browsers do give us.
 */

/** Below this many px a viewport change is browser chrome (URL bar), not a keyboard. */
const KEYBOARD_MIN_HEIGHT = 80;

/** A keyboard never covers more than this share of the viewport; guards against odd layouts. */
const KEYBOARD_MAX_RATIO = 0.7;

/** Breathing room left between the focused field and the top of the keyboard. */
const FIELD_MARGIN = 16;

/**
 * Pixels of the viewport currently covered by the on-screen keyboard.
 *
 * Returns 0 on native, where the platform already handles this: iOS through
 * `ScrollView`'s `automaticallyAdjustKeyboardInsets` and Android through the
 * `adjustResize` soft-input mode, which shrinks the RN root view. Adding our own
 * padding there would double-count and push content too far.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The layout viewport stays put while the keyboard is up under the
        // default `interactive-widget=resizes-visual` behaviour, which is what
        // both iOS Safari and Chrome do. Only the visual viewport shrinks, so
        // the difference is the covered strip. If a browser ever resizes the
        // layout viewport instead, this naturally computes ~0 — the layout has
        // already made room and no spacer is needed.
        const layout = document.documentElement.clientHeight;
        const covered = layout - (vv.height + vv.offsetTop);
        const isKeyboard =
          covered >= KEYBOARD_MIN_HEIGHT && covered <= layout * KEYBOARD_MAX_RATIO;
        setInset(isKeyboard ? Math.round(covered) : 0);
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}

/**
 * Keeps the focused text field inside the strip the keyboard leaves visible.
 *
 * Room to scroll is not the same as being scrolled: once `useKeyboardInset` has
 * added its spacer the field *can* be reached, but the user should not have to
 * do it by hand. Runs when the keyboard opens and again whenever focus moves to
 * another field while it is already open.
 */
export function useScrollFocusedFieldIntoView(inset: number): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (inset <= 0) return;

    let timer: ReturnType<typeof setTimeout>;

    const reveal = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
      // Wait a frame or two so the spacer is laid out before we scroll to it,
      // otherwise the scroll target is clamped to the old (shorter) content.
      clearTimeout(timer);
      timer = setTimeout(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        // Scroll by an exact delta rather than `scrollIntoView`, which centres
        // the field in the *container* — and the container still spans the full
        // layout viewport, so its centre is roughly where the keyboard starts.
        const visibleBottom = vv.offsetTop + vv.height;
        const overflow = el.getBoundingClientRect().bottom + FIELD_MARGIN - visibleBottom;
        if (overflow <= 0) return;

        let node: HTMLElement | null = el.parentElement;
        while (node) {
          const overflowY = getComputedStyle(node).overflowY;
          if (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight
          ) {
            break;
          }
          node = node.parentElement;
        }
        const scroller = node ?? (document.scrollingElement as HTMLElement | null);
        scroller?.scrollBy({ top: overflow, behavior: 'smooth' });
      }, 60);
    };

    reveal();
    document.addEventListener('focusin', reveal);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', reveal);
    };
  }, [inset]);
}
