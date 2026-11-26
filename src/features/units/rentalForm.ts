/**
 * S-03 Rental editor — form model + validation (pure). Money fields hold integer cents (the UI kit's money input
 * gives cents or null); `null` = left blank. Errors are i18n keys of the `units` namespace.
 */
import { reviewModeHint } from '@/engine';
import type { ReviewMode, SmokingPolicy } from '@/db/schema';
import type { NewRental, Rental } from '@/db/types';

import { isUsState } from './usStates';

export interface RentalForm {
  street: string;
  unit: string;
  city: string;
  /** Two-letter code or '' (not chosen). */
  state: string;
  zip: string;
  rentCents: number | null;
  /** 0 = studio. */
  bedrooms: number;
  bathrooms: number | null;
  /** 'YYYY-MM-DD' or null. */
  availableOn: string | null;
  depositCents: number | null;
  feeCents: number | null;
  notes: string;
  reviewMode: ReviewMode;
  smokingPolicy: SmokingPolicy;
}

export type RentalField = keyof RentalForm;

/** i18n key (`units:s03.errors.*`) per field; only fields with an error are present. */
export type RentalErrors = Partial<Record<RentalField, RentalErrorKey>>;

export type RentalErrorKey =
  | 'streetRequired'
  | 'rentRequired'
  | 'zip'
  | 'state'
  | 'bedrooms'
  | 'bathrooms'
  | 'date'
  | 'money'
  | 'tooLong';

/** Field order on screen: Save with errors scrolls to the first one (product.md §5.0). */
export const RENTAL_FIELD_ORDER: readonly RentalField[] = [
  'street',
  'unit',
  'city',
  'state',
  'zip',
  'rentCents',
  'bedrooms',
  'bathrooms',
  'availableOn',
  'depositCents',
  'feeCents',
  'notes',
  'reviewMode',
];

export const MAX_TEXT = 120;
export const MAX_NOTES = 2000;
export const MAX_BEDROOMS = 8;
export const MAX_BATHROOMS = 8;

export function emptyRentalForm(): RentalForm {
  return {
    street: '',
    unit: '',
    city: '',
    state: '',
    zip: '',
    rentCents: null,
    bedrooms: 1,
    bathrooms: null,
    availableOn: null,
    depositCents: null,
    feeCents: 0,
    notes: '',
    reviewMode: 'compare',
    smokingPolicy: 'non_smoking',
  };
}

export function rentalToForm(r: Rental): RentalForm {
  return {
    street: r.street,
    unit: r.unit ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zip: r.zip ?? '',
    rentCents: r.rentCents,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    availableOn: r.availableOn,
    depositCents: r.depositCents,
    feeCents: r.feeCents,
    notes: r.notes ?? '',
    reviewMode: r.reviewMode,
    smokingPolicy: r.smokingPolicy,
  };
}

function isIsoDate(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (mo < 1 || mo > 12 || day < 1) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return day <= dim;
}

const isCents = (v: number) => Number.isSafeInteger(v) && v >= 0;

/** All errors of the form ({} = valid). Same check on blur (one field) and on Save (all). */
export function validateRental(f: RentalForm): RentalErrors {
  const e: RentalErrors = {};
  if (!f.street.trim()) e.street = 'streetRequired';
  else if (f.street.trim().length > MAX_TEXT) e.street = 'tooLong';
  if (f.unit.trim().length > MAX_TEXT) e.unit = 'tooLong';
  if (f.city.trim().length > MAX_TEXT) e.city = 'tooLong';
  if (f.state && !isUsState(f.state)) e.state = 'state';
  if (f.zip.trim() && !/^\d{5}$/.test(f.zip.trim())) e.zip = 'zip';
  if (f.rentCents === null || !Number.isSafeInteger(f.rentCents) || f.rentCents <= 0) e.rentCents = 'rentRequired';
  if (!Number.isInteger(f.bedrooms) || f.bedrooms < 0 || f.bedrooms > MAX_BEDROOMS) e.bedrooms = 'bedrooms';
  if (f.bathrooms !== null && !(f.bathrooms >= 0 && f.bathrooms <= MAX_BATHROOMS && Number.isInteger(f.bathrooms * 2))) {
    e.bathrooms = 'bathrooms';
  }
  if (f.availableOn !== null && !isIsoDate(f.availableOn)) e.availableOn = 'date';
  if (f.depositCents !== null && !isCents(f.depositCents)) e.depositCents = 'money';
  if (f.feeCents !== null && !isCents(f.feeCents)) e.feeCents = 'money';
  if (f.notes.length > MAX_NOTES) e.notes = 'tooLong';
  return e;
}

/** The error of one field (on blur). */
export function validateRentalField(f: RentalForm, field: RentalField): RentalErrorKey | null {
  return validateRental(f)[field] ?? null;
}

/** First field with an error, in screen order (Save → scroll + focus there). */
export function firstErrorField(errors: RentalErrors): RentalField | null {
  return RENTAL_FIELD_ORDER.find((k) => errors[k]) ?? null;
}

const opt = (s: string) => (s.trim() ? s.trim() : null);

/** Valid form → row values (trimmed, blanks → null, state upper-case, fee blank → $0). */
export function formToRentalValues(f: RentalForm): Omit<NewRental, 'id' | 'createdAt' | 'status' | 'closedAt' | 'isSample'> {
  return {
    street: f.street.trim(),
    unit: opt(f.unit),
    city: opt(f.city),
    state: f.state ? f.state.toUpperCase() : null,
    zip: opt(f.zip),
    rentCents: f.rentCents ?? 0,
    bedrooms: f.bedrooms,
    bathrooms: f.bathrooms,
    availableOn: f.availableOn,
    depositCents: f.depositCents,
    feeCents: f.feeCents ?? 0,
    smokingPolicy: f.smokingPolicy,
    notes: opt(f.notes),
    reviewMode: f.reviewMode,
  };
}

/** Unsaved changes? (sheet / back → "Discard changes?"). Compares the values that would be saved. */
export function isRentalFormDirty(initial: RentalForm, current: RentalForm): boolean {
  return JSON.stringify(formToRentalValues(initial)) !== JSON.stringify(formToRentalValues(current));
}

/** Orange hint under Review mode (WA → "Seattle requires first-come order."), never switches the mode. */
export function rentalModeHint(f: Pick<RentalForm, 'state'>): string | null {
  return reviewModeHint(f.state);
}
