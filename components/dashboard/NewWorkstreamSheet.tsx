import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius } from '../../constants/theme';
import { TranslationKey } from '../../constants/translations';
import { formatLongDate, parseDate, todayISO } from '../../lib/dashboard';

type T = (key: TranslationKey) => string;

/**
 * Create a workstream — a named effort like "Stake Conference — November".
 *
 * Deliberately two fields. A workstream earns its keep by grouping items, not
 * by carrying its own metadata; anything more here and it starts competing
 * with the items it's supposed to organise.
 */
export function NewWorkstreamSheet({
  visible, language, t, onClose, onCreate,
}: {
  visible: boolean;
  language: 'en' | 'es';
  t: T;
  onClose: () => void;
  onCreate: (name: string, targetDate: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [name, setName] = useState('');
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setTarget(null);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, anim]);

  function shift(days: number) {
    const base = target ?? todayISO();
    const d = parseDate(base);
    d.setDate(d.getDate() + days);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    setTarget(`${d.getFullYear()}-${m}-${day}`);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.wrap}>
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: anim,
                paddingBottom: insets.bottom + 16,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
              },
            ]}
          >
            <View style={styles.grabber} />
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Text style={styles.cancel}>{t('dash.edit.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{t('dash.workstream.newTitle')}</Text>
              <View style={{ width: 52 }} />
            </View>

            <Text style={styles.label}>{t('dash.workstream.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('dash.workstream.namePlaceholder')}
              placeholderTextColor={Colors.gray[400]}
            />

            <Text style={styles.label}>{t('dash.workstream.targetLabel')}</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepper} onPress={() => shift(-7)} activeOpacity={0.8}>
                <Ionicons name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.stepperValue}>
                <Text style={styles.value}>
                  {target ? formatLongDate(target, language) : t('dash.workstream.noTarget')}
                </Text>
              </View>
              <TouchableOpacity style={styles.stepper} onPress={() => shift(7)} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
              disabled={!name.trim()}
              onPress={() => { onCreate(name.trim(), target); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.createBtnText}>{t('dash.workstream.create')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.35)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Same cap-on-the-wrapper rule as ItemSheet — see the note there.
  wrap: { width: '100%', maxWidth: 640, maxHeight: '88%' },
  sheet: {
    width: '100%',
    flexShrink: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  grabber: {
    width: 36, height: 4, borderRadius: Radius.full,
    backgroundColor: Colors.gray[200], alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  cancel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[500], width: 52 },
  label: {
    fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500],
    letterSpacing: 0.3, marginTop: 16, marginBottom: 6,
  },
  input: {
    height: 48, borderWidth: 1.5, borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: 12, fontSize: FontSize.md, color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: {
    width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  stepperValue: {
    flex: 1, height: 48, borderWidth: 1.5, borderColor: Colors.gray[200],
    borderRadius: Radius.md, paddingHorizontal: 12, justifyContent: 'center',
  },
  value: { fontSize: FontSize.md, color: Colors.gray[900] },
  createBtn: {
    height: 48, borderRadius: Radius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  createBtnDisabled: { backgroundColor: Colors.gray[300] },
  createBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
