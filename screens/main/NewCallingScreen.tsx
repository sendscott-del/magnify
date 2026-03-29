import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ward, CallingType } from '../../lib/database.types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize, Radius, Shadow } from '../../constants/theme';
import { CALLING_GROUPS } from '../../constants/callings';

const TYPE_OPTIONS: { label: string; value: CallingType; emoji: string }[] = [
  { label: 'Ward Calling', value: 'ward_calling', emoji: '🏠' },
  { label: 'Stake Calling', value: 'stake_calling', emoji: '⭐' },
  { label: 'MP Ordination', value: 'mp_ordination', emoji: '🙏' },
];

const ORDINATION_OPTIONS = [
  { label: 'Elder', value: 'elder' },
  { label: 'High Priest', value: 'high_priest' },
];

export function NewCallingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [type, setType] = useState<CallingType>('ward_calling');
  const [memberName, setMemberName] = useState('');
  const [wardId, setWardId] = useState('');
  const [wardName, setWardName] = useState('');
  const [callingName, setCallingName] = useState('');
  const [customCallingName, setCustomCallingName] = useState('');
  const [ordinationType, setOrdinationType] = useState<'elder' | 'high_priest'>('elder');
  const [notes, setNotes] = useState('');
  const [bishopApproved, setBishopApproved] = useState(false);
  const [loading, setLoading] = useState<'ideas' | 'approval' | null>(null);
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
  }

  async function handleSave(targetStage: 'ideas' | 'for_approval') {
    const finalCallingName = type === 'mp_ordination'
      ? `Melchizedek Priesthood Ordination (${ordinationType === 'elder' ? 'Elder' : 'High Priest'})`
      : (callingName === 'Other' ? customCallingName : callingName);

    if (!memberName.trim()) { setError('Member name is required.'); return; }
    if (!finalCallingName.trim()) { setError('Please specify a calling or ordination.'); return; }

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

    await supabase.from('calling_log').insert({
      calling_id: newCalling.id,
      action: stage === 'hc_approval'
        ? 'MP Ordination created — sent directly to HC Approval'
        : stage === 'for_approval'
          ? 'Calling created and submitted for Stake Presidency approval'
          : 'Calling created and added to Ideas',
      to_stage: stage,
      performed_by: user?.id,
    });

    setLoading(null);
    resetForm();

    const dest = type === 'mp_ordination' ? 'HC' : 'PresidencyBoard';
    if (Platform.OS === 'web') {
      navigation.navigate(dest);
    } else {
      Alert.alert('Success', 'Entry added successfully.', [
        { text: 'OK', onPress: () => navigation.navigate(dest) },
      ]);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>New Entry</Text>
        <Text style={styles.subtitle}>Add a calling or ordination</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Selector */}
        <Text style={styles.sectionLabel}>Type</Text>
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
              <Text style={styles.typeEmoji}>{opt.emoji}</Text>
              <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'mp_ordination' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>MP Ordinations are sent directly to HC Approval after the stake presidency interview.</Text>
          </View>
        )}

        {/* Member Name */}
        <Input
          label="Member Name"
          value={memberName}
          onChangeText={setMemberName}
          placeholder="Full name"
          leftIcon="person-outline"
        />

        {/* Ward Picker (optional) */}
        <Text style={styles.fieldLabel}>Ward <Text style={styles.optionalLabel}>(optional)</Text></Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowWardPicker(true)}
        >
          <Text style={wardId ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
            {wardId ? wardName : 'Select ward…'}
          </Text>
          <Text style={styles.pickerArrow}>▼</Text>
        </TouchableOpacity>

        {/* Calling / Ordination */}
        {type === 'mp_ordination' ? (
          <>
            <Text style={styles.sectionLabel}>Ordination Type</Text>
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
            <Text style={styles.fieldLabel}>Calling</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowCallingPicker(true)}
            >
              <Text style={callingName ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                {callingName || 'Select calling…'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {(callingName === 'Other' || callingName === '') && (
              <Input
                label="Custom Calling Name"
                value={customCallingName}
                onChangeText={setCustomCallingName}
                placeholder="Enter calling name"
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
            <Text style={styles.checkLabel}>Bishop has approved this calling</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional context…"
          multiline
          numberOfLines={3}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {type === 'mp_ordination' ? (
          <Button
            title="Submit to HC Approval"
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
              title="Add to Ideas"
              onPress={() => handleSave('ideas')}
              loading={loading === 'ideas'}
              disabled={loading !== null}
              variant="outline"
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />
            <Button
              title="Submit for SP Approval"
              onPress={() => handleSave('for_approval')}
              loading={loading === 'approval'}
              disabled={loading !== null}
              fullWidth
              size="lg"
              style={styles.submitBtnSecondary}
            />
          </>
        )}
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
            <Text style={styles.modalTitle}>Select Ward</Text>
            <TouchableOpacity
              style={[styles.modalItem, !wardId && styles.modalItemSelected]}
              onPress={() => { setWardId(''); setWardName(''); setShowWardPicker(false); }}
            >
              <Text style={[styles.modalItemText, !wardId && styles.modalItemTextSelected]}>
                No ward / TBD
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
            <Text style={styles.modalTitle}>Select Calling</Text>
            <FlatList
              data={[
                ...CALLING_GROUPS.flatMap(g => [
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
  typeEmoji: { fontSize: 20, marginBottom: 4 },
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
});
