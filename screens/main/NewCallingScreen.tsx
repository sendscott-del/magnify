import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Platform, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ward, CallingType } from '../../lib/database.types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DisclaimerFooter } from '../../components/ui/DisclaimerFooter';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { CALLING_GROUPS } from '../../constants/callings';
import { useLanguage } from '../../context/LanguageContext';
import { notifyNewCallingPosted } from '../../lib/slack';
import { STAGE_LABELS } from '../../constants/callings';

export function NewCallingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();

  const TYPE_OPTIONS: { label: string; value: CallingType; icon: any }[] = [
    { label: t('type.ward_calling'), value: 'ward_calling', icon: require('../../assets/icon_ward.png') },
    { label: t('type.stake_calling'), value: 'stake_calling', icon: require('../../assets/icon_stake.png') },
    { label: t('type.mp_ordination'), value: 'mp_ordination', icon: require('../../assets/icon_mp.png') },
  ];

  const ORDINATION_OPTIONS = [
    { label: t('ordination.elder'), value: 'elder' },
    { label: t('ordination.highPriest'), value: 'high_priest' },
  ];

  const [type, setType] = useState<CallingType>('ward_calling');
  const [memberName, setMemberName] = useState('');
  const [wardId, setWardId] = useState('');
  const [wardName, setWardName] = useState('');
  const [callingName, setCallingName] = useState('');
  const [customCallingName, setCustomCallingName] = useState('');
  const [ordinationType, setOrdinationType] = useState<'elder' | 'high_priest'>('elder');
  const [notes, setNotes] = useState('');
  const [bishopApproved, setBishopApproved] = useState(false);
  const [releaseMemberName, setReleaseMemberName] = useState('');
  const [releaseCurrentCalling, setReleaseCurrentCalling] = useState('');
  const [releaseWardId, setReleaseWardId] = useState('');
  const [releaseWardName, setReleaseWardName] = useState('');
  const [showReleaseWardPicker, setShowReleaseWardPicker] = useState(false);
  const [loading, setLoading] = useState<'ideas' | 'approval' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');

  const [wards, setWards] = useState<Ward[]>([]);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [showCallingPicker, setShowCallingPicker] = useState(false);

  useEffect(() => {
    supabase.from('wards').select('*').order('name').then(({ data }) => {
      if (data) setWards(data as Ward[]);
    });
  }, []);

  function resetForm() {
    setMemberName('');
    setWardId('');
    setWardName('');
    setCallingName('');
    setCustomCallingName('');
    setNotes('');
    setBishopApproved(false);
    setReleaseMemberName('');
    setReleaseCurrentCalling('');
    setReleaseWardId('');
    setReleaseWardName('');
  }

  async function handleSave(targetStage: 'ideas' | 'for_approval') {
    const finalCallingName = type === 'mp_ordination'
      ? `Melchizedek Priesthood Ordination (${ordinationType === 'elder' ? t('ordination.elder') : t('ordination.highPriest')})`
      : (callingName === 'Other' ? customCallingName : callingName);

    if (!memberName.trim()) { setError(t('validation.memberNameRequired')); return; }
    if (!finalCallingName.trim()) { setError(t('validation.callingRequired')); return; }

    setLoading(targetStage === 'ideas' ? 'ideas' : 'approval');
    setError('');

    // MP ordinations skip straight to HC Approval
    const stage = type === 'mp_ordination' ? 'hc_approval' : targetStage;

    const payload: any = {
      type,
      member_name: memberName.trim(),
      calling_name: finalCallingName.trim(),
      ward_id: wardId || null,
      stage,
      rejected: false,
      bishop_approved: type === 'ward_calling' ? bishopApproved : false,
      notes: notes.trim() || null,
      release_member_name: releaseMemberName.trim() || null,
      release_current_calling: releaseCurrentCalling.trim() || null,
      release_ward_id: releaseWardId || null,
      created_by: user?.id,
    };

    if (type === 'mp_ordination') {
      payload.ordination_type = ordinationType;
    }

    const { data: newCalling, error: insertErr } = await supabase
      .from('callings')
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      setError(insertErr.message);
      setLoading(null);
      return;
    }

    // Audit log (non-blocking)
    supabase.from('calling_log').insert({
      calling_id: newCalling.id,
      action: stage === 'hc_approval'
        ? t('log.mpCreated')
        : stage === 'for_approval'
          ? t('log.callingSubmitted')
          : t('log.callingIdeas'),
      to_stage: stage,
      performed_by: user?.id,
    }).then(() => {});

    // Notify SP Slack channel (fire and forget)
    const wardData = wards.find(w => w.id === wardId);
    notifyNewCallingPosted({
      memberName: memberName.trim(),
      callingName: finalCallingName.trim(),
      wardName: wardData?.name,
      submittedBy: profile?.full_name ?? 'Unknown',
      stage: STAGE_LABELS[stage] ?? stage,
    }).catch(() => {});

    setLoading(null);
    resetForm();
    setShowConfirmation(true);
  }

  // Confirmation screen after successful submission
  if (showConfirmation) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.confirmationContainer}>
          <View style={styles.confirmationIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.confirmationTitle}>{t('common.success')}</Text>
          <Text style={styles.confirmationMessage}>
            {t('new.entryAdded')}{'\n\n'}Your calling recommendation has been submitted to the Stake Presidency for review.
          </Text>
          <Button
            title={t('new.submitAnother') ?? 'Submit Another'}
            onPress={() => setShowConfirmation(false)}
            style={{ marginTop: Spacing.lg }}
          />
          <TouchableOpacity
            onPress={() => {
              setShowConfirmation(false);
              navigation.navigate('HC');
            }}
            style={styles.confirmationLink}
          >
            <Text style={styles.confirmationLinkText}>{t('hcBoard.title') ?? 'Go to HC Board'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('new.title')}</Text>
        <Text style={styles.subtitle}>{t('new.subtitle')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Selector */}
        <Text style={styles.sectionLabel}>{t('new.typeLabel')}</Text>
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
              onPress={() => {
                setType(opt.value);
                setCallingName('');
                setCustomCallingName('');
                setBishopApproved(false);
              }}
            >
              <Image source={opt.icon} style={styles.typeIconImg} />
              <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'mp_ordination' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{t('new.mpInfo')}</Text>
          </View>
        )}

        {/* Member Name */}
        <Input
          label={t('new.memberName')}
          value={memberName}
          onChangeText={setMemberName}
          placeholder={t('new.memberNamePlaceholder')}
          leftIcon="person-outline"
        />

        {/* Ward Picker (optional) */}
        <Text style={styles.fieldLabel}>{t('new.ward')} <Text style={styles.optionalLabel}>{t('detail.optional')}</Text></Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowWardPicker(true)}
        >
          <Text style={wardId ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
            {wardId ? wardName : t('new.selectWard')}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Calling / Ordination */}
        {type === 'mp_ordination' ? (
          <>
            <Text style={styles.sectionLabel}>{t('new.ordinationType')}</Text>
            <View style={styles.typeRow}>
              {ORDINATION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.typeBtn, ordinationType === opt.value && styles.typeBtnActive, { flex: 1 }]}
                  onPress={() => setOrdinationType(opt.value as 'elder' | 'high_priest')}
                >
                  <Text style={[styles.typeLabel, ordinationType === opt.value && styles.typeLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>{t('new.callingLabel')}</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowCallingPicker(true)}
            >
              <Text style={callingName ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                {callingName || t('new.selectCalling')}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {(callingName === 'Other' || callingName === '') && (
              <Input
                label={t('new.customCallingName')}
                value={customCallingName}
                onChangeText={setCustomCallingName}
                placeholder={t('new.customCallingPlaceholder')}
              />
            )}
          </>
        )}

        {/* Bishop Approved (ward callings only) */}
        {type === 'ward_calling' && (
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setBishopApproved(!bishopApproved)}
          >
            <View style={[styles.checkbox, bishopApproved && styles.checkboxOn]}>
              {bishopApproved && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>{t('new.bishopApproved')}</Text>
          </TouchableOpacity>
        )}

        {/* Member to be Released */}
        <View style={styles.releaseSection}>
          <Text style={styles.sectionLabel}>{t('release.sectionTitle')} <Text style={styles.optionalLabel}>({t('detail.optional')})</Text></Text>
          <Text style={styles.releaseHint}>{t('release.hint')}</Text>
          <Input
            label={t('release.memberName')}
            value={releaseMemberName}
            onChangeText={setReleaseMemberName}
            placeholder={t('release.memberNamePlaceholder')}
            leftIcon="person-remove-outline"
          />
          <Input
            label={t('release.currentCalling')}
            value={releaseCurrentCalling}
            onChangeText={setReleaseCurrentCalling}
            placeholder={t('release.currentCallingPlaceholder')}
          />
          <Text style={styles.fieldLabel}>Ward <Text style={styles.optionalLabel}>(Optional)</Text></Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowReleaseWardPicker(true)}
          >
            <Text style={releaseWardId ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
              {releaseWardId ? releaseWardName : t('new.selectWard')}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <Input
          label={t('new.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('new.notesPlaceholder')}
          multiline
          numberOfLines={3}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {type === 'mp_ordination' ? (
          <Button
            title={t('new.submitToHCApproval')}
            onPress={() => handleSave('for_approval')}
            loading={loading === 'approval'}
            disabled={loading !== null}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        ) : (
          <>
            <Button
              title={t('new.submitIdea')}
              onPress={() => handleSave('ideas')}
              loading={loading === 'ideas'}
              disabled={loading !== null}
              variant="outline"
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />
            <Button
              title={t('new.submitForSPApproval')}
              onPress={() => handleSave('for_approval')}
              loading={loading === 'approval'}
              disabled={loading !== null}
              fullWidth
              size="lg"
              style={styles.submitBtnSecondary}
            />
          </>
        )}
        <DisclaimerFooter />
      </ScrollView>

      {/* Ward Picker Modal */}
      <Modal
        visible={showWardPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWardPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWardPicker(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('new.selectWardTitle')}</Text>
            <TouchableOpacity
              style={[styles.modalItem, !wardId && styles.modalItemSelected]}
              onPress={() => { setWardId(''); setWardName(''); setShowWardPicker(false); }}
            >
              <Text style={[styles.modalItemText, !wardId && styles.modalItemTextSelected]}>
                {t('new.noWard')}
              </Text>
            </TouchableOpacity>
            <FlatList
              data={wards}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, wardId === item.id && styles.modalItemSelected]}
                  onPress={() => {
                    setWardId(item.id);
                    setWardName(item.name);
                    setShowWardPicker(false);
                  }}
                >
                  <Text style={[styles.modalItemText, wardId === item.id && styles.modalItemTextSelected]}>
                    {item.name}
                  </Text>
                  <Text style={styles.modalItemAbbr}>{item.abbreviation}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Release Ward Picker Modal */}
      <Modal
        visible={showReleaseWardPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReleaseWardPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReleaseWardPicker(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('release.selectWardTitle')}</Text>
            <TouchableOpacity
              style={[styles.modalItem, !releaseWardId && styles.modalItemSelected]}
              onPress={() => { setReleaseWardId(''); setReleaseWardName(''); setShowReleaseWardPicker(false); }}
            >
              <Text style={[styles.modalItemText, !releaseWardId && styles.modalItemTextSelected]}>
                {t('release.noWard')}
              </Text>
            </TouchableOpacity>
            <FlatList
              data={wards}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, releaseWardId === item.id && styles.modalItemSelected]}
                  onPress={() => {
                    setReleaseWardId(item.id);
                    setReleaseWardName(item.name);
                    setShowReleaseWardPicker(false);
                  }}
                >
                  <Text style={[styles.modalItemText, releaseWardId === item.id && styles.modalItemTextSelected]}>
                    {item.name}
                  </Text>
                  <Text style={styles.modalItemAbbr}>{item.abbreviation}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calling Picker Modal */}
      <Modal
        visible={showCallingPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCallingPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCallingPicker(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('new.selectCallingTitle')}</Text>
            <FlatList
              data={[
                ...CALLING_GROUPS.filter(g => {
                  if (g.org === 'Other') return false;
                  if (type === 'ward_calling') return g.org === 'Bishopric' || g.org === 'Elders Quorum';
                  if (type === 'stake_calling') return g.org === 'Stake';
                  return true;
                }).flatMap(g => [
                  { type: 'header', label: g.org, value: `__header__${g.org}` },
                  ...g.callings.map(c => ({ type: 'item', label: c, value: c, org: g.org })),
                ]),
                { type: 'item', label: 'Other', value: 'Other', org: 'Other' },
              ]}
              keyExtractor={item => item.value}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return (
                    <View style={styles.modalGroupHeader}>
                      <Text style={styles.modalGroupHeaderText}>{item.label}</Text>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, callingName === item.value && styles.modalItemSelected]}
                    onPress={() => {
                      setCallingName(item.value);
                      if (item.value !== 'Other') setCustomCallingName('');
                      setShowCallingPicker(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, callingName === item.value && styles.modalItemTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[700],
    marginBottom: Spacing.sm, marginTop: Spacing.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  optionalLabel: { fontWeight: '400', color: Colors.gray[400] },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.gray[200],
    backgroundColor: Colors.white, ...(Shadow as any),
  },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFade },
  typeIconImg: { width: 48, height: 48, borderRadius: 10, marginBottom: 6 },
  typeLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[600], textAlign: 'center' },
  typeLabelActive: { color: Colors.primary },
  infoBox: {
    backgroundColor: Colors.info + '15', borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.info + '40',
  },
  infoText: { fontSize: FontSize.sm, color: Colors.info, lineHeight: 20 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gray[50], borderWidth: 1.5, borderColor: Colors.gray[200],
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2, marginBottom: Spacing.md,
  },
  pickerBtnText: { fontSize: FontSize.md, color: Colors.black },
  pickerBtnPlaceholder: { fontSize: FontSize.md, color: Colors.gray[400] },
  pickerArrow: { color: Colors.gray[400], fontSize: 12 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: Spacing.md, paddingVertical: Spacing.xs,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: Colors.gray[300], marginRight: Spacing.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  checkboxOn: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkMark: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  checkLabel: { fontSize: FontSize.md, color: Colors.gray[700] },
  releaseSection: {
    backgroundColor: Colors.warning + '0D',
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  releaseHint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.sm, lineHeight: 18 },
  error: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  submitBtn: { marginTop: Spacing.md },
  submitBtnSecondary: { marginTop: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, maxHeight: '70%', paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900],
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  modalGroupHeader: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.gray[50] },
  modalGroupHeaderText: {
    fontSize: FontSize.xs, fontWeight: '800', color: Colors.gray[500],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.gray[100],
  },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemAbbr: { fontSize: FontSize.sm, color: Colors.gray[400], fontWeight: '600' },
  confirmationContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  confirmationIcon: { marginBottom: Spacing.md },
  confirmationTitle: {
    fontSize: FontSize.xxl, fontWeight: '800', color: Colors.gray[900],
    marginBottom: Spacing.sm,
  },
  confirmationMessage: {
    fontSize: FontSize.md, color: Colors.gray[600],
    textAlign: 'center', lineHeight: 22,
  },
  confirmationLink: {
    marginTop: Spacing.lg, paddingVertical: Spacing.sm,
  },
  confirmationLinkText: {
    fontSize: FontSize.md, color: Colors.primary, fontWeight: '600',
  },
});
