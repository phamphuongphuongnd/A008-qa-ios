/**
 * What S-21 / S-22 / S-23 show, as pure data (tested without rendering): rows, values, button states.
 */
import type { AppSettings } from '@/db/repos/settings';
import { formatDate } from '@/engine';
import { t } from '@/i18n';

import { canEnableLock, landlordUnlockMethod, type AuthCapability } from './lock';
import { appLockRowValue, appearanceRowValue, backupRowValue, biometricLabel, cleanupRowValue } from './summary';

export type SettingsRowKey =
  | 'name'
  | 'contact'
  | 'appLock'
  | 'backup'
  | 'cleanup'
  | 'appearance'
  | 'reminders'
  | 'sample'
  | 'legal'
  | 'about'
  | 'deleteAll';

export interface SettingsRow {
  key: SettingsRowKey;
  title: string;
  value?: string;
  chevron: boolean;
  danger?: boolean;
}

export interface SettingsSection {
  title?: string;
  rows: SettingsRow[];
}

export interface SettingsInput {
  settings: AppSettings;
  now: Date;
  biometric: AuthCapability['biometric'];
  ios: boolean;
  cleanupCount: number;
  hasSample: boolean;
  appVersion: string | null;
}

/** S-21 (mockup order): Letters · Privacy & data · App · Legal / About / Delete all. */
export function settingsSections(i: SettingsInput): SettingsSection[] {
  const s = i.settings;
  const contactSet = !!(s.landlordAddress.trim() || s.landlordPhone.trim());
  return [
    {
      title: t('system:s21.sectionLetters'),
      rows: [
        { key: 'name', title: t('system:s21.yourName'), value: s.landlordName.trim() || t('system:s21.notSet'), chevron: true },
        { key: 'contact', title: t('system:s21.contact'), value: contactSet ? t('system:s21.set') : t('system:s21.notSet'), chevron: true },
      ],
    },
    {
      title: t('system:s21.sectionPrivacy'),
      rows: [
        { key: 'appLock', title: t('system:s21.appLock'), value: appLockRowValue(s, i.biometric, i.ios), chevron: true },
        { key: 'backup', title: t('system:s21.backup'), value: backupRowValue(s, i.now), chevron: true },
        { key: 'cleanup', title: t('system:s21.cleanup'), value: cleanupRowValue(i.cleanupCount), chevron: true },
      ],
    },
    {
      title: t('system:s21.sectionApp'),
      rows: [
        { key: 'appearance', title: t('system:s21.appearance'), value: appearanceRowValue(s.theme), chevron: true },
        { key: 'reminders', title: t('system:s21.reminders'), chevron: true },
        { key: 'sample', title: i.hasSample ? t('system:s21.removeSample') : t('system:s21.loadSample'), chevron: false },
      ],
    },
    {
      rows: [
        { key: 'legal', title: t('system:s21.legal'), chevron: true },
        { key: 'about', title: t('system:s21.about'), value: i.appVersion ? t('system:s21.version', { version: i.appVersion }) : undefined, chevron: false },
        { key: 'deleteAll', title: t('system:s21.deleteAll'), chevron: false, danger: true },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// S-22
// ---------------------------------------------------------------------------

export interface BackupView {
  /** "Nov 30, 2026 · 12.4 MB" or "No backup yet". */
  lastLine: string;
  /** Help under "Automatic backup". */
  folderHelp: string;
  /** Show "couldn't reach the folder" warning. */
  autoFailed: boolean;
  /** Back up now opens the password sheet first. */
  needsPassword: boolean;
}

export function backupView(
  status: { hasPassword: boolean; last: { at: string; bytes: number | null } | null; autoBackup: 'off' | 'weekly'; folderLabel: string | null; autoFailedAt: string | null },
  ios: boolean,
  formatBytes: (n: number) => string,
): BackupView {
  const last = status.last;
  const lastLine = last
    ? last.bytes != null
      ? t('system:s22.lastBackupValue', { date: formatDate(last.at.slice(0, 10)), size: formatBytes(last.bytes) })
      : formatDate(last.at.slice(0, 10))
    : t('system:s22.never');
  const base = ios ? t('system:s22.folderHintIos') : t('system:s22.folderHintAndroid');
  return {
    lastLine,
    folderHelp: status.autoBackup === 'weekly' && status.folderLabel ? t('system:s22.folder', { name: status.folderLabel }) : base,
    autoFailed: status.autoBackup === 'weekly' && !!status.autoFailedAt,
    needsPassword: !status.hasPassword,
  };
}

// ---------------------------------------------------------------------------
// S-23
// ---------------------------------------------------------------------------

export interface AppLockView {
  /** Switch title: "Require Face ID to open" on a Face ID phone, product text otherwise. */
  switchTitle: string;
  /** "Lock after" choices only while the lock is on. */
  showLockAfter: boolean;
  /** Phone without biometrics or passcode: the app PIN section. */
  usesAppPin: boolean;
  /** Turning on needs a PIN first. */
  needsPinFirst: boolean;
}

export function appLockView(s: Pick<AppSettings, 'appLock' | 'appPinHash'>, cap: AuthCapability, ios: boolean): AppLockView {
  const method = landlordUnlockMethod(cap, s);
  return {
    switchTitle: cap.biometric
      ? t('system:s23.requireMethod', { method: biometricLabel(cap.biometric, ios) })
      : cap.deviceSecure
        ? t('system:s23.requireDevice')
        : t('system:s23.requirePin'),
    showLockAfter: s.appLock,
    usesAppPin: method !== 'system',
    needsPinFirst: !canEnableLock(cap, s),
  };
}

// ---------------------------------------------------------------------------
// S-26
// ---------------------------------------------------------------------------

/** Sources listed on S-26 (FTC, HUD, Seattle — product.md S-26). Check the links before each release. */
export const LEGAL_SOURCES: readonly { label: string; url: string }[] = [
  { label: 'FTC — Using consumer reports: what landlords need to know', url: 'https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-landlords-need-know' },
  { label: 'FTC — Disposing of consumer report information', url: 'https://www.ftc.gov/business-guidance/resources/disposing-consumer-report-information-rule-tells-how' },
  { label: 'HUD — Fair Housing Act overview', url: 'https://www.hud.gov/program_offices/fair_housing_equal_opp/fair_housing_act_overview' },
  { label: 'City of Seattle — Renting in Seattle', url: 'https://www.seattle.gov/rentinginseattle' },
];
