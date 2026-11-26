/**
 * Pure view logic of S-02, S-03, S-06 (what to show, labels, which actions) — tested without rendering.
 */
import type { ChipTone } from '@/ui';
import { t } from '@/i18n';

import type { RentalErrors, RentalField } from './rentalForm';
import type { RentalHub } from './rentalQueries';
import type { DisplayStatus } from './rentalSummary';
import { US_STATES } from './usStates';

/** Chip tone per Rental status (mockup v2: Open indigo · Offer out amber · Leased neutral · Closed outline). */
export function statusTone(status: DisplayStatus): ChipTone {
  switch (status) {
    case 'open':
      return 'accent';
    case 'offer_out':
      return 'warn';
    case 'leased':
      return 'neutral';
    case 'closed':
      return 'outline';
  }
}

export type RentalsView = 'empty_all' | 'empty_open' | 'empty_closed' | 'list';

/** S-02 body: the first-run empty state only when there is no rental at all. */
export function rentalsView(filter: 'open' | 'closed', counts: { open: number; closed: number }): RentalsView {
  if (counts.open + counts.closed === 0) return 'empty_all';
  if (filter === 'open' && counts.open === 0) return 'empty_open';
  if (filter === 'closed' && counts.closed === 0) return 'empty_closed';
  return 'list';
}

/** S-02 backup card text. */
export function backupReminderText(backup: { days: number | null }): string {
  return backup.days === null ? t('units:s02.reminders.backupNever') : t('units:s02.reminders.backup', { count: backup.days });
}

export type SwipeAction = 'close' | 'reopen' | 'delete';

/** S-02 swipe-left actions (also offered as accessibility actions). */
export function swipeActions(status: DisplayStatus): SwipeAction[] {
  return status === 'closed' ? ['reopen', 'delete'] : ['close'];
}

export function swipeLabel(a: SwipeAction): string {
  return t(`units:s02.swipe.${a}`);
}

export type HubMenuKey = 'editRental' | 'editCriteria' | 'published' | 'decisionFile' | 'closeRental' | 'reopenRental' | 'deleteRental';

/** S-06 ⋯ menu (product.md §5 S-06), Close ↔ Reopen by status; Delete last, red. */
export function hubMenuItems(status: DisplayStatus): { key: HubMenuKey; label: string; danger: boolean }[] {
  const keys: HubMenuKey[] = [
    'editRental',
    'editCriteria',
    'published',
    'decisionFile',
    status === 'closed' ? 'reopenRental' : 'closeRental',
    'deleteRental',
  ];
  return keys.map((key) => ({ key, label: t(`units:s06.menu.${key}`), danger: key === 'deleteRental' }));
}

/** S-06 second button: Compare (Compare mode) or Order queue (First-come), with the count; none without applicants. */
export function hubReviewButton(hub: Pick<RentalHub, 'reviewMode' | 'applicantCount'>): { kind: 'compare' | 'queue'; label: string } | null {
  if (hub.applicantCount === 0) return null;
  return hub.reviewMode === 'compare'
    ? { kind: 'compare', label: t('units:s06.compare', { count: hub.applicantCount }) }
    : { kind: 'queue', label: t('units:s06.orderQueue', { count: hub.applicantCount }) };
}

/** S-03 header + main button. */
export function editorTexts(isNew: boolean): { title: string; subtitle: string | null; button: string } {
  return isNew
    ? { title: t('units:s03.titleNew'), subtitle: t('units:s03.step'), button: t('units:s03.next') }
    : { title: t('units:s03.titleEdit'), subtitle: null, button: t('units:s03.save') };
}

/** Error messages per field, translated. */
export function rentalErrorMessages(errors: RentalErrors): Partial<Record<RentalField, string>> {
  const out: Partial<Record<RentalField, string>> = {};
  for (const [field, key] of Object.entries(errors) as [RentalField, NonNullable<RentalErrors[RentalField]>][]) {
    out[field] = t(`units:s03.errors.${key}`, { max: 120 });
  }
  return out;
}

export interface PickerOption<T> {
  value: T;
  label: string;
}

/** Bedrooms 0 (Studio) … 8. */
export const BEDROOM_OPTIONS: PickerOption<number>[] = Array.from({ length: 9 }, (_, n) => ({
  value: n,
  label: n === 0 ? t('units:rental.studio') : String(n),
}));

/** Bathrooms: not set, 1 … 5 in halves. */
export const BATHROOM_OPTIONS: PickerOption<number | null>[] = [
  { value: null, label: '—' },
  ...Array.from({ length: 9 }, (_, i) => {
    const v = 1 + i / 2;
    return { value: v, label: String(v) };
  }),
];

export const STATE_OPTIONS: PickerOption<string>[] = US_STATES.map((s) => ({ value: s.code, label: s.name }));

export function optionLabel<T>(options: readonly PickerOption<T>[], value: T, fallback = ''): string {
  return options.find((o) => o.value === value)?.label ?? fallback;
}
