import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalProps, Platform } from 'react-native';

/**
 * `Modal` that never asks iOS to close a sheet it is still opening.
 *
 * React Native's iOS modal (RCTModalHostViewComponentView, RN 0.83) reacts to
 * `visible` flipping to false by calling `dismissViewControllerAnimated:`
 * immediately, with no check that the presentation animation has finished.
 * UIKit drops a dismissal issued mid-presentation, but React Native has
 * already marked the sheet as gone and unmounted its children — leaving an
 * empty, transparent, full-screen view controller on top of the app that
 * swallows every touch. The screen underneath draws normally; nothing recovers
 * it except a force-quit. Reported 2026-09-13 on the App Store build (2.54.1),
 * most often on the calling detail screen, whose task-assignment picker is the
 * sheet people tap through fastest. A fast tap on a name during the ~350 ms
 * slide-up is all it takes.
 *
 * The mirror race — reopening while a dismissal is still animating — makes the
 * new presentation fail silently instead (the presenting controller is busy),
 * so the sheet just never appears.
 *
 * This wrapper serialises the two: a close requested before `onShow` waits for
 * it, and an open requested before `onDismiss` waits for it. A safety timer
 * covers the case where the platform never fires the callback (a presentation
 * that failed outright), so a request can never be lost. Web and Android have
 * no UIKit presentation and pass straight through.
 */
const SETTLE_FALLBACK_MS = 1000;

export function SafeModal(props: ModalProps) {
  if (Platform.OS !== 'ios') return <Modal {...props} />;
  return <IosSafeModal {...props} />;
}

function IosSafeModal({ visible = false, onShow, onDismiss, ...rest }: ModalProps) {
  // What the native modal is actually told. `shownRef` mirrors it so the
  // decision logic below never depends on a stale render.
  const [shown, setShown] = useState<boolean>(visible);
  const shownRef = useRef(visible);
  // True from the moment the native side is told to present/dismiss until it
  // reports back through onShow/onDismiss (or the fallback timer fires).
  const settling = useRef(false);
  // The latest `visible` the caller asked for; applied once settled.
  const wanted = useRef(visible);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearFallback() {
    if (fallback.current) { clearTimeout(fallback.current); fallback.current = null; }
  }

  // Push the caller's wish to the native modal if it differs from what is on
  // screen and nothing is mid-transition. Otherwise do nothing: `settle` runs
  // this again when the in-flight transition reports back.
  function apply() {
    if (settling.current) return;
    if (shownRef.current === wanted.current) return;
    shownRef.current = wanted.current;
    settling.current = true;
    clearFallback();
    fallback.current = setTimeout(settle, SETTLE_FALLBACK_MS);
    setShown(wanted.current);
  }

  function settle() {
    clearFallback();
    settling.current = false;
    apply();
  }

  useEffect(() => {
    wanted.current = visible;
    apply();
    // `apply` reads only refs and a stable setter; re-running on `visible` is
    // the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => clearFallback, []);

  return (
    <Modal
      {...rest}
      visible={shown}
      onShow={e => { settle(); onShow?.(e); }}
      onDismiss={() => { settle(); onDismiss?.(); }}
    />
  );
}
