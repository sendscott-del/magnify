import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboard } from '../../context/DashboardContext';
import { useIsDesktopWeb } from '../../lib/useDeviceWidth';
import {
  DashInterview, DashboardItem, KIND, duePill, formatMonthDay,
} from '../../lib/dashboard';
import { DrillKey, Scope, isOpen, itemsForDrill, scopeItems } from '../../lib/dashboardTiles';
import { DrillHeader } from '../../components/dashboard/DrillHeader';
import { ItemSheet } from '../../components/dashboard/ItemSheet';
import { InterviewSheet } from '../../components/dashboard/InterviewSheet';
import { Toast } from '../../components/dashboard/Toast';
import { CalmEmpty, cardBase } from '../../components/dashboard/primitives';

/**
 * The list behind a tile or a workstream.
 *
 * Two kinds of drill live here: `magnify_items` lists (recommend, audit,
 * assignment, directive, workstream) and the quarterly-interview list, which
 * is read from steward_interviews and — since 025 — written back to it, so a
 * presidency member can complete, reschedule, reassign or add an interview
 * here without opening Steward.
 */
export function DashboardDrillScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t, language } = useLanguage();
  const { user, profile, isPresidency, isClerk } = useAuth();
  const data = useDashboard();
  const isDesktopWeb = useIsDesktopWeb();
  const canEditInterviews = isPresidency || isClerk;
  const ownerChoices = useMemo(
    () => ((isPresidency || isClerk) ? data.owners : data.owners.filter(o => o.calling === 'high_council')),
    [isPresidency, isClerk, data.owners],
  );

  const drill = (route.params?.drill ?? 'action') as DrillKey;
  const title = route.params?.title ?? t('dash.title');
  // Mirrors the scope the tile was counting when it was tapped.
  const scope = (route.params?.scope ?? 'mine') as Scope;

  const [openItem, setOpenItem] = useState<DashboardItem | null>(null);
  const [openInterview, setOpenInterview] = useState<DashInterview | null>(null);
  const [newInterview, setNewInterview] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  useEffect(() => {
    if (!data.lastError) return;
    setToast({ message: data.lastError });
    data.clearError();
  }, [data.lastError, data]);

  const openItems = useMemo(
    () => scopeItems(
      data.items.filter(isOpen),
      scope,
      user?.id ?? null,
      profile?.full_name ?? null,
    ),
    [data.items, scope, user?.id, profile?.full_name],
  );

  const rows = useMemo(
    () => (drill === 'interview' || drill === 'myInterview' ? [] : itemsForDrill(drill, openItems)),
    [drill, openItems],
  );

  const interviewRows = useMemo(() => {
    if (drill !== 'interview' && drill !== 'myInterview') return [];
    // The quarterly-interview tile is a stake-wide count in either scope; only
    // the high councilor's "my interview" tile narrows to one person.
    const mineOnly = drill === 'myInterview';
    return data.interviews.filter(i => {
      if (!mineOnly) return true;
      return (user?.id && i.assigned_to_user_id === user.id)
        || (profile?.full_name && i.assignee_name === profile.full_name);
    });
  }, [drill, data.interviews, user?.id, profile?.full_name]);

  const count = rows.length + interviewRows.length;
  const isInterviewDrill = drill === 'interview' || drill === 'myInterview';

  function markDone(item: DashboardItem) {
    void data.setItemStatus(item.id, true);
    setToast({
      message: t('dash.toast.markedDone'),
      undo: () => { void data.setItemStatus(item.id, false); setToast(null); },
    });
  }

  return (
    <View style={styles.root}>
      <DrillHeader
        title={title}
        subtitle={`${count} ${count === 1 ? t('dash.drill.item') : t('dash.drill.items')}`}
        onBack={() => nav.goBack()}
        rightElement={isInterviewDrill && canEditInterviews ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setNewInterview(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('dash.interview.add')}
          >
            <Ionicons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : undefined}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {count === 0 && (
          <CalmEmpty title={t('dash.drill.emptyTitle')} sub={t('dash.drill.emptySub')} />
        )}

        {rows.map(item => {
          const pill = duePill(item.due_on, t, language, true);
          const owner = item.owner_label
            ?? (item.owner_user_id ? data.ownerNames[item.owner_user_id] : null);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.row, { borderLeftColor: KIND[item.kind].color }]}
              onPress={() => setOpenItem(item)}
              activeOpacity={0.8}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {!!item.detail && <Text style={styles.rowSub} numberOfLines={1}>{item.detail}</Text>}
              </View>
              <View style={styles.rowRight}>
                {pill && <Text style={[styles.rowDue, { color: pill.color }]}>{pill.label}</Text>}
                {!!owner && <Text style={styles.rowOwner} numberOfLines={1}>{owner}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        {interviewRows.map(iv => (
          <TouchableOpacity
            key={iv.id}
            style={[styles.row, { borderLeftColor: KIND.interview.color }]}
            onPress={canEditInterviews ? () => setOpenInterview(iv) : undefined}
            disabled={!canEditInterviews}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>{iv.interviewee_name}</Text>
              {!!iv.interviewee_calling && (
                <Text style={styles.rowSub} numberOfLines={1}>{iv.interviewee_calling}</Text>
              )}
            </View>
            <View style={styles.rowRight}>
              <Text
                style={[
                  styles.rowDue,
                  { color: iv.completed_at ? Colors.success : Colors.gray[600] },
                ]}
              >
                {iv.completed_at
                  ? t('dash.drill.interviewDone')
                  : iv.scheduled_for
                    ? formatMonthDay(iv.scheduled_for, language)
                    : t('dash.drill.notScheduled')}
              </Text>
              {!!iv.assignee_name && (
                <Text style={styles.rowOwner} numberOfLines={1}>{iv.assignee_name}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {isInterviewDrill && interviewRows.length > 0 && (
          <Text style={styles.readOnlyNote}>{t('dash.drill.interviewsWriteThrough')}</Text>
        )}
      </ScrollView>

      <ItemSheet
        item={openItem}
        visible={!!openItem}
        owners={ownerChoices}
        workstreams={data.workstreams}
        ownerNames={data.ownerNames}
        language={language}
        t={t}
        onClose={() => setOpenItem(null)}
        onSave={patch => {
          if (openItem) void data.updateItem(openItem.id, patch);
          setToast({ message: t('dash.toast.saved') });
        }}
        onToggleDone={done => {
          if (!openItem) return;
          if (done) markDone(openItem);
          else void data.setItemStatus(openItem.id, false);
        }}
        onDelete={() => {
          if (!openItem) return;
          void data.deleteItem(openItem.id);
          setOpenItem(null);
          setToast({ message: t('dash.toast.deleted') });
        }}
      />

      <InterviewSheet
        interview={openInterview}
        visible={!!openInterview || newInterview}
        assignees={data.presidencyMembers}
        language={language}
        t={t}
        onClose={() => { setOpenInterview(null); setNewInterview(false); }}
        onSave={draft => {
          void data.saveInterview(draft);
          setToast({ message: t('dash.toast.interviewSaved') });
        }}
        onComplete={done => {
          if (!openInterview) return;
          void data.completeInterview(openInterview.id, done);
          setToast({ message: done ? t('dash.toast.interviewDone') : t('dash.toast.interviewReopened') });
        }}
        onDelete={() => {
          if (!openInterview) return;
          void data.deleteInterview(openInterview.id);
          setToast({ message: t('dash.toast.interviewDeleted') });
        }}
      />

      {toast && (
        <Toast
          message={toast.message}
          undoLabel={toast.undo ? t('dash.toast.undo') : undefined}
          onUndo={toast.undo}
          onDismiss={() => setToast(null)}
          bottomOffset={isDesktopWeb ? 0 : 56}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.gray[50] },
  scroll: { padding: Spacing.md, gap: 8 },
  row: {
    ...cardBase,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowLeft: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
  },
  rowSub: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: 2,
  },
  rowRight: { alignItems: 'flex-end', maxWidth: 130 },
  rowDue: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  rowOwner: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  readOnlyNote: {
    fontSize: FontSize.xs,
    color: Colors.gray[400],
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
