import { TranslationKey } from './translations';

/**
 * What a high councilor is over, beyond his assigned wards.
 *
 * These keys are the CHECK constraint on `hc_member_stewardships.stewardship`
 * (migration 035) — **edit the two together or a write will be refused.**
 *
 * Added 2026-09-20 so "the high councilor over seminary" is answerable: the
 * Protecting Children and Youth follow-ups route seminary teachers to him, and
 * before this nothing in the database recorded who that was.
 *
 * The order here is the chip order on the roster screen: the stake
 * organizations first, then the stewardships that cut across them.
 */
export const STEWARDSHIPS = [
  'elders_quorum',
  'relief_society',
  'young_men',
  'young_women',
  'primary',
  'sunday_school',
  'seminary',
  'temple_family_history',
  'missionary',
  'welfare_self_reliance',
  'single_adults',
  'emergency_prep',
] as const;

export type Stewardship = (typeof STEWARDSHIPS)[number];

/** Translation key for a stewardship's label. */
export function stewardshipKey(s: Stewardship): TranslationKey {
  return `stewardship.${s}` as TranslationKey;
}
