import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

interface SlackSetting { id: string; event_type: string; webhook_url: string; active: boolean; }

export function SlackSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [slackSettings, setSlackSettings] = useState<SlackSetting[]>([]);
  const [slackDraft, setSlackDraft] = useState<Record<string, string>>({});
  const [slackSaving, setSlackSaving] = useState<Record<string, boolean>>({});
  const [slackTesting, setSlackTesting] = useState<Record<string, boolean>>({});

  const fetchSlackSettings = useCallback(async () => {
    const { data } = await supabase.from('slack_settings').select('*').order('event_type');
    const rows = (data as SlackSetting[]) ?? [];
    setSlackSettings(rows);
    const drafts: Record<string, string> = {};
    rows.forEach(r => { drafts[r.event_type] = r.webhook_url; });
    setSlackDraft(drafts);
  }, []);

  useFocusEffect(useCallback(() => { fetchSlackSettings(); }, [fetchSlackSettings]));

  async function testSlackWebhook(eventType: string) {
    const url = slackSettings.find(s => s.event_type === eventType)?.webhook_url;
    if (!url) return;
    setSlackTesting(prev => ({ ...prev, [eventType]: true }));
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ text: '✅ *Magnify test* — Slack integration is working!' }),
      });
      if (Platform.OS === 'web') window.alert(t('settings.slackTestSent'));
      else Alert.alert(t('settings.sent'), t('settings.slackTestSent'));
    } catch {
      if (Platform.OS === 'web') window.alert(t('settings.slackTestFailed'));
      else Alert.alert(t('common.error'), t('settings.slackTestFailed'));
    }
    setSlackTesting(prev => ({ ...prev, [eventType]: false }));
  }

  async function saveSlackWebhook(eventType: string) {
    const url = (slackDraft[eventType] ?? '').trim();
    setSlackSaving(prev => ({ ...prev, [eventType]: true }));
    const existing = slackSettings.find(s => s.event_type === eventType);
    if (existing) {
      await supabase.from('slack_settings').update({ webhook_url: url, active: !!url }).eq('id', existing.id);
    } else if (url) {
      await supabase.from('slack_settings').insert({ event_type: eventType, webhook_url: url, active: true });
    }
    await fetchSlackSettings();
    setSlackSaving(prev => ({ ...prev, [eventType]: false }));
  }

  const activeCount = slackSettings.filter(s => s.active).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.gray[700]} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{t('settings.slackNotifications')}</Text>
          <Text style={styles.subtitle}>
            {activeCount} {t('slackSettings.activeOf')} 5 {t('slackSettings.active')}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.hint}>{t('settings.slackHint')}</Text>
          {[
            { key: 'sp_stage_change', label: t('settings.spBoardWebhook') },
            { key: 'hc_stage_change', label: t('settings.hcBoardWebhook') },
            { key: 'rejection', label: t('settings.rejectionWebhook') },
            { key: 'user_access_request', label: t('settings.accessRequestWebhook') },
            { key: 'user_access_approved', label: t('settings.accessApprovedWebhook') },
          ].map(({ key, label }) => {
            const active = slackSettings.find(s => s.event_type === key)?.active;
            return (
              <View key={key} style={styles.row}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{label}</Text>
                  {active && <Text style={styles.activePill}>● {t('settings.active')}</Text>}
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={slackDraft[key] ?? ''}
                    onChangeText={v => setSlackDraft(prev => ({ ...prev, [key]: v }))}
                    placeholder={t('settings.webhookPlaceholder')}
                    placeholderTextColor={Colors.gray[400]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, slackSaving[key] && styles.btnDisabled]}
                    onPress={() => saveSlackWebhook(key)}
                    disabled={slackSaving[key]}
                  >
                    <Text style={styles.saveBtnText}>{slackSaving[key] ? '…' : t('settings.save')}</Text>
                  </TouchableOpacity>
                  {active && (
                    <TouchableOpacity
                      style={[styles.testBtn, slackTesting[key] && styles.btnDisabled]}
                      onPress={() => testSlackWebhook(key)}
                      disabled={slackTesting[key]}
                    >
                      <Text style={styles.testBtnText}>{slackTesting[key] ? '…' : t('settings.test')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100], gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.gray[200], ...(Shadow as any),
  },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 18 },
  row: { marginBottom: Spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700] },
  activePill: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.gray[50], borderWidth: 1.5,
    borderColor: Colors.gray[200], borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    fontSize: FontSize.xs, color: Colors.black,
  },
  saveBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, backgroundColor: Colors.primary,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  testBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.success,
  },
  testBtnText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
