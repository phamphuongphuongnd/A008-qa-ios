/**
 * Display text for Rentals (S-02, S-03, S-06, published criteria). Money: integer cents → "$1,650". Dates: wall-clock
 * as written in the ISO string (what the landlord saw), never re-zoned.
 */
import type { ApplicantStatus } from '@/engine';
import { formatDate, formatUsd } from '@/engine';
import { t } from '@/i18n';

import type { DisplayStatus } from './rentalSummary';

export interface AddressParts {
  street: string;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clean = (s: string | null | undefined) => (s ?? '').trim();

/** "1428 Maple St, Unit B" (the unit as typed). */
export function addressLine(r: AddressParts): string {
  return [clean(r.street), clean(r.unit)].filter(Boolean).join(', ');
}

/** "Columbus, OH 43215". */
export function cityLine(r: AddressParts): string {
  const stateZip = [clean(r.state).toUpperCase(), clean(r.zip)].filter(Boolean).join(' ');
  return [clean(r.city), stateZip].filter(Boolean).join(', ');
}

/** "1428 Maple St, Unit B, Columbus, OH 43215". */
export function fullAddress(r: AddressParts): string {
  return [addressLine(r), cityLine(r)].filter(Boolean).join(', ');
}

/** "$1,650/mo". */
export function rentText(rentCents: number): string {
  return t('units:rental.perMonth', { rent: formatUsd(rentCents) });
}

/** "2 bd" / "Studio". */
export function bedroomsText(bedrooms: number): string {
  return bedrooms === 0 ? t('units:rental.studio') : t('units:rental.bedrooms', { count: bedrooms });
}

/** 'YYYY-MM-DD' → "Jan 1" (no year). */
export function shortDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** S-02 card: "$1,650/mo · 2 bd". */
export function rentalCardLine(r: { rentCents: number; bedrooms: number }): string {
  return `${rentText(r.rentCents)} · ${bedroomsText(r.bedrooms)}`;
}

/** S-06 header: "$1,650/mo · 2 bd · Available Jan 1". */
export function rentalHubLine(r: { rentCents: number; bedrooms: number; availableOn?: string | null }): string {
  const parts = [rentText(r.rentCents), bedroomsText(r.bedrooms)];
  if (r.availableOn) parts.push(t('units:rental.available', { date: shortDate(r.availableOn) }));
  return parts.join(' · ');
}

/** Published criteria: "$1,650/mo · Available Jan 1, 2027". */
export function rentalPublishedLine(r: { rentCents: number; availableOn?: string | null }): string {
  const parts = [rentText(r.rentCents)];
  if (r.availableOn) parts.push(t('units:rental.available', { date: formatDate(r.availableOn) }));
  return parts.join(' · ');
}

/** Received timestamp → "Dec 2, 9:14 AM" (wall-clock in the string). */
export function receivedText(ts: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(ts);
  if (!m) return ts;
  const h = Number(m[3]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}, ${h12}:${m[4]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function reviewModeLabel(mode: 'compare' | 'first_come'): string {
  return t(mode === 'compare' ? 'units:mode.compare' : 'units:mode.first_come');
}

export function reviewModeChip(mode: 'compare' | 'first_come'): string {
  return t(mode === 'compare' ? 'units:mode.compareChip' : 'units:mode.firstComeChip');
}

export function rentalStatusLabel(status: DisplayStatus): string {
  return t(`units:status.${status}`);
}

export function applicantStatusLabel(status: ApplicantStatus): string {
  return t(`units:applicantStatus.${status}`);
}
