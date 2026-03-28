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
  const [orgRecommended, setOrgRecommended] = useState(false);
  const [bishopApproved, setBishopApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [wards, setWards] = useState<Ward[]>([]);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [showCallingPicker, setShowCallingPicker] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState('');

  useEffect(() => {
    supabase
      .from('wards')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setWards(data as Ward[]);
      });
  }, []);

  const isOther = callingName === 'Other' || callingName === '';

  async function handleSubmit() {
    const finalCallingName = type === 'mp_ordination'
      ? `Melchizedek Priesthood Ordination (${ordinationType === 'elder' ? 'Elder' : 'High Priest'})`
      : (callingName === 'Other' ? customCallingName : callingName);

    if (!memberName.trim()) { setError('Member name is required.'); return; }
    if (!wardId) { setError('Please select a ward.'); return; }
    if (!finalCallingName.trim()) { setError('Please specify a calling or ordination.'); return; }

    setLoading(true);
    setError('');

    const payload: any = {
      type,
      member_name: memberName.trim(),
      calling_name: finalCallingName.trim(),
      ward_id: wardId,
      stage: 'ideas',
      rejected: false,
      org_recommended: orgRecommended,
      bishop_approved: bishopApproved,
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
      setLoading(false);
      return;
    }

    // Log the creation
    await supabase.from('calling_log').insert({
      calling_id: newCalling.id,
      action: 'Calling created',
      to_stage: 'ideas',
      performed_by: user?.id,
      notes: 'New calling entered into system',
    });

    setLoading(false);

    // Reset form
    setMemberName('');
    setWardId('');
    setWardName('');
    setCallingName('');
    setCustomCallingName('');
    setNotes('');
    setOrgRecommended(false);
    setBishopApproved(false);

    if (Platform.OS === 'web') {
      // Navigate to HC board
      navigation.navigate('HC');
    } else {
      Alert.alert('Success', 'Calling added successfully.', [
        { text: 'OK', onPress: () => navigation.navigate('HC') },
      ]);
    }
  }

  const allCallings = CALLING_GROUPS.flatMap(g => g.callings.map(c => ({ org: g.org, name: c })));

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
              }}
            >
              <Text style={styles.typeEmoji}>{opt.emoji}</Text>
              <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Member Name */}
        <Input
          label="Member Name"
          value={memberName}
          onChangeText={setMemberName}
          placeholder="Full name"
          leftIcon="person-outline"
        />

        {/* Ward Picker */}
        <Text style={styles.fieldLabel}>Ward</Text>
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

        {/* Notes */}
        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional context…"
          multiline
          numberOfLines={3}
        />

        {/* Checkboxes */}
        <View style={styles.checkRow}>
          <TouchableOpacity
            style={styles.checkItem}
            onPress={() => setOrgRecommended(!orgRecommended)}
          >
            <View style={[styles.checkbox, orgRecommended && styles.checkboxChecked]}>
              {orgRecommended && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Org / Bishop Recommended</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.checkRow}>
          <TouchableOpacity
            style={styles.checkItem}
            onPress={() => setBishopApproved(!bishopApproved)}
          >
            <View style={[styles.checkbox, bishopApproved && styles.checkboxChecked]}>
              {bishopApproved && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Bishop Approved</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Add to Ideas Board"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submitBtn}
        />
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
                    <Text style={[
                      styles.modalItemText,
                      callingName === item.value && styles.modalItemTextSelected,
                    ]}>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.gray[700],
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray[700],
    marginBottom: Spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    backgroundColor: Colors.white,
    ...(Shadow as any),
  },
  typeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFade,
  },
  typeEmoji: { fontSize: 20, marginBottom: 4 },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray[600],
    textAlign: 'center',
  },
  typeLabelActive: {
    color: Colors.primary,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gray[50],
    borderWidth: 1.5,
    borderColor: Colors.gray[200],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  pickerBtnText: { fontSize: FontSize.md, color: Colors.black },
  pickerBtnPlaceholder: { fontSize: FontSize.md, color: Colors.gray[400] },
  pickerArrow: { color: Colors.gray[400], fontSize: 12 },
  checkRow: { marginBottom: Spacing.sm },
  checkItem: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.gray[300],
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkMark: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: FontSize.md, color: Colors.gray[700] },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  submitBtn: { marginTop: Spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '70%',
    paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalGroupHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.gray[50],
  },
  modalGroupHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  modalItemSelected: { backgroundColor: Colors.primaryFade },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[800] },
  modalItemTextSelected: { color: Colors.primary, fontWeight: '700' },
  modalItemAbbr: { fontSize: FontSize.sm, color: Colors.gray[400], fontWeight: '600' },
});
