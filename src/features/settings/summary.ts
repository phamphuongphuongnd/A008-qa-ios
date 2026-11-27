/**
 * S-21 Settings rows: the short value shown on the right of each row, and the landlord's contact (printed on letters).
 * Pure — the screen passes the settings, the clock and the counts it read.
 */
import type { AppSettings } from '@/db/repos/settings';
import { t } from '@/i18n';

import type { BiometricKind } from './lock';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `fromIso` to `now` in the phone's zone (0 = today). Negative clamps to 0. */
export function daysSince(fromIso: string, now: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** "Today" · "Yesterday" · "34 days ago". */
export function relativeDays(days: number): string {
  if (days <= 0) return t('system:relative.today');
  if (days === 1) return t('system:relative.yesterday');
  return t('system:relative.daysAgo', { count: days });
}

/** S-21 "Backup & restore" value: "Never" or "34 days ago". */
export function backupRowValue(s: Pick<AppSettings, 'lastBackupAt'>, now: Date = new Date()): string {
  return s.lastBackupAt ? relativeDays(daysSince(s.lastBackupAt, now)) : t('system:relative.never');
}

/** S-21 "App lock" value: "Off" · "Face ID" · "Fingerprint" · "Phone passcode" · "PIN". */
export function appLockRowValue(s: Pick<AppSettings, 'appLock' | 'appPinHash'>, biometric: BiometricKind | null, ios: boolean): string {
  if (!s.appLock) return t('system:s21.off');
  if (s.appPinHash) return t('system:lock.method.pin');
  if (biometric) return biometricLabel(biometric, ios);
  return t('system:lock.method.device');
}

/**
 * "Fingerprint or face" on its own (S-21 row value); `inSentence` → "fingerprint or face" for "Require … to open"
 * (B-150: no capital mid-sentence). Face ID / Touch ID are names and keep their capitals.
 */
export function biometricLabel(kind: BiometricKind, ios: boolean, inSentence = false): string {
  const key =
    kind === 'face'
      ? ios
        ? 'faceId'
        : 'face'
      : kind === 'fingerprint'
        ? ios
          ? 'touchId'
          : 'fingerprint'
        : kind;
  return inSentence ? t(`system:lock.methodInSentence.${key}`) : t(`system:lock.method.${key}`);
}

/** S-21 "Data cleanup" value: "None" or "2 rentals" (closed rentals still holding not-selected applicants' data). */
export function cleanupRowValue(rentalCount: number): string {
  return rentalCount > 0 ? t('system:s21.rentalCount', { count: rentalCount }) : t('system:s21.none');
}

export function appearanceRowValue(theme: AppSettings['theme']): string {
  return t(`system:s21.theme.${theme}`);
}

// ---------------------------------------------------------------------------
// Landlord contact (S-21 "Your name", "Mailing address & phone") — printed on letters
// ---------------------------------------------------------------------------

export interface LandlordContact {
  landlordName: string;
  landlordAddress: string;
  landlordPhone: string;
}

export type ContactErrors = Partial<Record<keyof LandlordContact, string>>;

export const NAME_MAX = 80;
export const ADDRESS_MAX = 200;

/** US phone → "(614) 555-0142"; anything that is not 10 digits (or 1 + 10) is returned trimmed, unchanged. */
export function formatUsPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length !== 10) return input.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Errors as text, keyed by field (empty object = valid). Every field may be empty; letters then leave the line out. */
export function validateContact(c: LandlordContact): ContactErrors {
  const errors: ContactErrors = {};
  if (c.landlordName.trim().length > NAME_MAX) errors.landlordName = t('system:s21.errors.nameLong', { max: NAME_MAX });
  if (c.landlordAddress.trim().length > ADDRESS_MAX) errors.landlordAddress = t('system:s21.errors.addressLong', { max: ADDRESS_MAX });
  const phone = c.landlordPhone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const ok = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
    if (!ok || /[^\d\s()+.-]/.test(phone)) errors.landlordPhone = t('system:s21.errors.phone');
  }
  return errors;
}

/** Trimmed values ready for `updateSettings` (phone formatted). */
export function normalizeContact(c: LandlordContact): LandlordContact {
  return {
    landlordName: c.landlordName.trim(),
    landlordAddress: c.landlordAddress
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n'),
    landlordPhone: c.landlordPhone.trim() ? formatUsPhone(c.landlordPhone) : '',
  };
}
