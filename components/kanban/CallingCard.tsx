import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/theme';
import { Badge } from '../ui/Badge';
import { Calling } from '../../lib/database.types';
import { STAGE_LABELS } from '../../constants/callings';

const TYPE_LABELS: Record<string, string> = {
  ward_calling: 'Ward',
  stake_calling: 'Stake',
  mp_ordination: 'MP',
};

const TYPE_COLORS: Record<string, string> = {
  ward_calling: Colors.info,
  stake_calling: '#8B5CF6',
  mp_ordination: Colors.success,
};

const TYPE_ICONS: Record<string, any> = {
  ward_calling: require('../../assets/icon_ward.png'),
  stake_calling: require('../../assets/icon_stake.png'),
  mp_ordination: require('../../assets/icon_mp.png'),
};

interface Props {
  calling: Calling;
  onPress: () => void;
}

export function CallingCard({ calling, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, calling.rejected && styles.rejected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <Image source={TYPE_ICONS[calling.type]} style={styles.typeIcon} />
        <Text style={styles.name} numberOfLines={1}>{calling.member_name}</Text>
      </View>
      <Text style={styles.callingName} numberOfLines={1}>{calling.calling_name}</Text>
      <View style={styles.footer}>
        {calling.wards && <Text style={styles.ward}>{calling.wards.abbreviation}</Text>}
        <Badge label={STAGE_LABELS[calling.stage]} stage={calling.stage} />
      </View>
      {calling.rejected && (
        <View style={styles.rejectedBanner}>
          <Text style={styles.rejectedText}>DECLINED</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...(Shadow as any),
  },
  rejected: {
    borderColor: Colors.error,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Spacing.xs,
  },
  typeIcon: {
    width: 22,
    height: 22,
    borderRadius: 5,
    flexShrink: 0,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  callingName: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    marginBottom: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ward: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    fontWeight: '600',
  },
  rejectedBanner: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.error + '22',
    borderRadius: Radius.sm,
    padding: 3,
    alignItems: 'center',
  },
  rejectedText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
