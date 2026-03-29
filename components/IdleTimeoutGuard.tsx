import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

const IDLE_MS = 15 * 60 * 1000;
const WARN_MS = 3 * 60 * 1000;
const ACTIVE_MS = IDLE_MS - WARN_MS;

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  children: React.ReactNode;
}

export function IdleTimeoutGuard({ children }: Props) {
  const { t } = useLanguage();
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(WARN_MS);
  const lastActivity = useRef(Date.now());
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const signOut = useCallback(async () => {
    clearTimers();
    setShowWarning(false);
    await supabase.auth.signOut();
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    lastActivity.current = Date.now();
    setShowWarning(false);

    warningTimer.current = setTimeout(() => {
      setRemaining(WARN_MS);
      setShowWarning(true);
      countdownInterval.current = setInterval(() => {
        const elapsed = Date.now() - lastActivity.current - ACTIVE_MS;
        const left = WARN_MS - elapsed;
        if (left <= 0) {
          signOut();
        } else {
          setRemaining(left);
        }
      }, 1000);
      logoutTimer.current = setTimeout(signOut, WARN_MS);
    }, ACTIVE_MS);
  }, [signOut]);

  const resetTimer = useCallback(() => {
    if (showWarning) return;
    startTimers();
  }, [showWarning, startTimers]);

  useEffect(() => {
    startTimers();

    if (Platform.OS === 'web') {
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
      events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
      return () => {
        clearTimers();
        events.forEach(e => window.removeEventListener(e, resetTimer));
      };
    }

    return () => { clearTimers(); };
  }, [startTimers, resetTimer]);

  return (
    <>
      {children}
      <Modal visible={showWarning} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.title}>{t('idle.title')}</Text>
            <Text style={styles.body}>{t('idle.body')}</Text>
            <Text style={styles.countdown}>{formatTime(remaining)}</Text>
            <TouchableOpacity
              style={styles.stayBtn}
              onPress={() => {
                setShowWarning(false);
                startTimers();
              }}
            >
              <Text style={styles.stayBtnText}>{t('idle.staySignedIn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
              <Text style={styles.signOutBtnText}>{t('idle.signOutNow')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  countdown: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.error,
    marginBottom: Spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  stayBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  stayBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  signOutBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: Colors.gray[500],
    fontSize: FontSize.sm,
  },
});
