import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { TranslationKey } from '../constants/translations';

/**
 * Stake Presidency Dashboard — shared types, the item-kind catalog, and the
 * due-date vocabulary.
 *
 * Design rule from the handoff: ONE glyph and ONE color per kind, used
 * everywhere with no exceptions. Every kind color and Ionicon in the app comes
 * from KIND below — never inline a hex or a glyph name at a call site.
 */

// Kinds that can be stored on magnify_items.
export type ItemKind =
  | 'action'
  | 'assignment'
  | 'interview'
  | 'audit'
  | 'recommend'
  | 'directive';

// Two more kinds exist only for display. `standard` is a recurring Steward
// duty and `calling` is a kanban card — neither is ever a magnify_items row,
// because those live in steward_behaviors and callings respectively.
export type DisplayKind = ItemKind | 'standard' | 'calling';

export type ItemStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'dropped';
export type ItemSource = 'manual' | 'meeting' | 'lcr_sync' | 'email';
export type ReviewState = 'approved' | 'pending_review';

export interface DashboardItem {
  id: string;
  stake_id: string;
  kind: ItemKind;
  title: string;
  detail?: string | null;
  status: ItemStatus;
  owner_user_id?: string | null;
  owner_label?: string | null;
  due_on?: string | null;
  ward_id?: string | null;
  workstream_id?: string | null;
  meeting_id?: string | null;
  source: ItemSource;
  source_ref?: Record<string, unknown>;
  review_state: ReviewState;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface Workstream {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  target_date?: string | null;
  status: 'active' | 'done' | 'archived';
  sort_order: number;
}

export interface DashInterview {
  id: string;
  interviewee_name: string;
  interviewee_calling?: string | null;
  assigned_to_user_id?: string | null;
  assignee_name?: string | null;
  scheduled_for?: string | null;
  completed_at?: string | null;
}

export interface StandardWorkRow {
  id: string;
  name: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  category_name?: string | null;
  period_start: string;
  value?: 'y' | 'n' | 'na' | null;
  shared_task_id?: string | null;
}

export interface MetricPoint {
  metric_key: string;
  period_start: string;
  value: number;
  target?: number | null;
  synced_at: string;
}

export interface MetricDef {
  metric_key: string;
  label: string;
  label_es?: string | null;
  unit?: string | null;
  direction: 'up' | 'down';
  sort_order: number;
}

interface KindConfig {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** All-caps eyebrow shown on rows and sheets. */
  eyebrowKey: TranslationKey;
}

/**
 * The canonical kind catalog. Colors are the handoff's locked values; the two
 * that overlap Magnify's existing stage palette (assignment = HC approval
 * purple, calling = brand navy) deliberately reuse it so the dashboard reads as
 * the same product as the kanban.
 */
export const KIND: Record<DisplayKind, KindConfig> = {
  recommend:  { color: '#14B8A6',        icon: 'business-outline',      eyebrowKey: 'dash.kind.recommend' },
  audit:      { color: '#F97316',        icon: 'document-text-outline', eyebrowKey: 'dash.kind.audit' },
  assignment: { color: Colors.stage.hc_approval, icon: 'people-outline', eyebrowKey: 'dash.kind.assignment' },
  interview:  { color: '#22C55E',        icon: 'chatbubbles-outline',   eyebrowKey: 'dash.kind.interview' },
  standard:   { color: '#2563EB',        icon: 'repeat-outline',        eyebrowKey: 'dash.kind.standard' },
  calling:    { color: Colors.primary,   icon: 'git-branch-outline',    eyebrowKey: 'dash.kind.calling' },
  directive:  { color: '#EC4899',        icon: 'megaphone-outline',     eyebrowKey: 'dash.kind.directive' },
  action:     { color: Colors.info,      icon: 'ellipse-outline',       eyebrowKey: 'dash.kind.action' },
};

/** Glyph chips are the kind color at 13% alpha — the design system's recipe. */
export function tint(color: string): string {
  return color + '22';
}

// ------------------------------------------------------------------ dates --

/**
 * Parse a plain 'YYYY-MM-DD' as LOCAL midnight. `new Date('2026-09-02')` is
 * parsed as UTC and lands on Sep 1 in Chicago, which would show every due date
 * a day early. Steward's date helpers make the same choice for the same reason.
 */
export function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days from today to `iso`. Negative = overdue. Null when undated. */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const target = parseDate(iso).getTime();
  const now = parseDate(todayISO()).getTime();
  return Math.round((target - now) / 86400000);
}

export function formatMonthDay(iso: string, language: 'en' | 'es'): string {
  return parseDate(iso).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDate(iso: string, language: 'en' | 'es'): string {
  return parseDate(iso).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface DuePill {
  label: string;
  color: string;
  bg: string;
  urgent: boolean;
}

type T = (key: TranslationKey) => string;

/**
 * The due pill states from the handoff. `short` is the dense form used in
 * drill-down rows, where the full "OVERDUE 12 DAYS" would wrap.
 */
export function duePill(
  iso: string | null | undefined,
  t: T,
  language: 'en' | 'es',
  short = false,
): DuePill | null {
  const d = daysUntil(iso);
  if (d === null) return null;

  if (d < 0) {
    const n = Math.abs(d);
    return {
      label: short
        ? `${n}${t('dash.due.lateShort')}`
        : `${t('dash.due.overdue')} ${n} ${n === 1 ? t('dash.due.day') : t('dash.due.days')}`,
      color: Colors.error,
      bg: '#FEE2E2',
      urgent: true,
    };
  }
  if (d === 0) {
    return {
      label: short ? t('dash.due.todayShort') : t('dash.due.today'),
      color: '#92600a',
      bg: '#FEF3C7',
      urgent: true,
    };
  }
  if (d <= 7) {
    return {
      label: short
        ? `${t('dash.due.inShort')}${d}${t('dash.due.dayAbbrev')}`
        : `${t('dash.due.dueIn')} ${d} ${d === 1 ? t('dash.due.day') : t('dash.due.days')}`,
      color: '#92600a',
      bg: '#FEF3C7',
      urgent: true,
    };
  }
  return {
    label: formatMonthDay(iso!, language),
    color: Colors.gray[600],
    bg: Colors.gray[100],
    urgent: false,
  };
}

/** Zone 1 shows only what is actually blocked on you: overdue or due ≤ 7 days. */
export const URGENT_WINDOW_DAYS = 7;
/** Hard cap so Zone 1 can never become a backlog. */
export const ZONE1_MAX_ROWS = 7;

export function isUrgent(item: { due_on?: string | null }): boolean {
  const d = daysUntil(item.due_on);
  return d !== null && d <= URGENT_WINDOW_DAYS;
}

/** Overdue first, then soonest. Undated items sort last. */
export function byDueDate<TItem extends { due_on?: string | null }>(a: TItem, b: TItem): number {
  const da = daysUntil(a.due_on);
  const db = daysUntil(b.due_on);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

// ---------------------------------------------------------------- quarter --

export function currentQuarter(): { year: number; quarter: number } {
  const d = new Date();
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 };
}

export function quarterStartISO(year: number, quarter: number): string {
  const m = `${(quarter - 1) * 3 + 1}`.padStart(2, '0');
  return `${year}-${m}-01`;
}

export function quarterLabel(iso: string): string {
  const d = parseDate(iso);
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
