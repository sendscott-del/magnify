import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { notifySuggestion } from '../../lib/slack';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';

export function SuggestionFAB() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await notifySuggestion({
        suggestion: text.trim(),
        submittedBy: profile?.full_name ?? 'Unknown',
      });
    } catch (_) {}
    setSending(false);
    setText('');
    setOpen(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <>
      {/* Sent toast */}
      {sent && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.toastText}>{t('suggestion.toastSent')}</Text>
        </View>
      )}

      {/* FAB button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="bulb-outline" size={20} color={Colors.white} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="bulb" size={22} color={Colors.warning} />
              <Text style={styles.modalTitle}>{t('suggestion.modalTitle')}</Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={styles.closeBtn}
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color={Colors.gray[400]} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('suggestion.placeholder')}
              placeholderTextColor={Colors.gray[400]}
              multiline
              numberOfLines={4}
              style={styles.input}
              autoFocus
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelBtn]}
                onPress={() => { setOpen(false); setText(''); }}
              >
                <Text style={styles.cancelText}>{t('suggestion.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!text.trim() || sending) && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={!text.trim() || sending}
              >
                <Text style={styles.submitText}>{sending ? t('suggestion.sending') : t('suggestion.submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
    opacity: 0.85,
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: Radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 200,
  },
  toastText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  input: {
    backgroundColor: Colors.gray[50],
    borderWidth: 1,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.gray[800],
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.gray[600],
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: FontSize.md,
    color: Colors.white,
    fontWeight: '600',
  },
});
