/**
 * Hooks for S-11 … S-14: live reads (re-run when the listed tables change, `useLive`) + the actions bound to the app's
 * database, files and native adapter. Thin on purpose — the logic is in ./service.ts and is tested there.
 * 'use no memo' on every hook that queries the DB (fact react-compiler-use-no-memo).
 */
import { db, useLive } from '@/db';
import { files, fileStore } from '@/files';

import { openExternal } from './links';
import { expoVerifyNative } from './native';
import * as S from './service';

const REF_TABLES = ['applicants', 'residences', 'incomes', 'references', 'attempts', 'decisions', 'criteria'] as const;

/** S-11 data (null = applicant / residence not found). */
export function useLandlordSheet(applicantId: number, residenceId: number): S.LandlordSheet | null {
  'use no memo';
  return useLive(() => S.loadLandlordSheet(db, applicantId, residenceId), [applicantId, residenceId], REF_TABLES);
}

/** S-12 data (null = applicant / income not found). */
export function useEmployerSheet(applicantId: number, incomeId: number): S.EmployerSheet | null {
  'use no memo';
  return useLive(() => S.loadEmployerSheet(db, applicantId, incomeId), [applicantId, incomeId], REF_TABLES);
}

/** S-13 data. */
export function useReportSheet(applicantId: number): S.ReportSheet | null {
  'use no memo';
  return useLive(() => S.loadReportSheet(db, applicantId), [applicantId], ['applicants', 'reports', 'criteria']);
}

/** S-14 data. */
export function useBackgroundSheet(applicantId: number): S.BackgroundSheet | null {
  'use no memo';
  return useLive(() => S.loadBackgroundSheet(db, applicantId), [applicantId], ['applicants', 'background', 'decisions', 'criteria']);
}

/** Every S-11 … S-14 write, bound to the app database / files. Plain object: no state, safe to call each render. */
export const verifyActions = {
  saveLandlord: (applicantId: number, residenceId: number, form: Parameters<typeof S.saveLandlordSheet>[3]) => S.saveLandlordSheet(db, applicantId, residenceId, form),
  ensureLandlordRef: (applicantId: number, residenceId: number) => S.ensureLandlordRef(db, applicantId, residenceId),
  saveEmployer: (applicantId: number, incomeId: number, form: Parameters<typeof S.saveEmployerSheet>[3]) => S.saveEmployerSheet(db, applicantId, incomeId, form),
  ensureEmployerRef: (applicantId: number, incomeId: number) => S.ensureEmployerRef(db, applicantId, incomeId),
  logAttempt: (referenceId: number, input: S.AttemptInput) => S.logAttempt(db, referenceId, input),
  removeAttempt: (attemptId: number, referenceId: number) => S.removeAttempt(db, attemptId, referenceId),
  markUnreachable: (referenceId: number) => S.markUnreachable(db, referenceId),
  clearUnreachable: (referenceId: number) => S.clearUnreachable(db, referenceId),
  saveReport: (applicantId: number, form: Parameters<typeof S.saveReportSheet>[2]) => S.saveReportSheet(db, applicantId, form),
  attachReportFiles: (applicantId: number, picked: readonly S.PickedFile[]) => S.attachReportFiles(db, files, applicantId, picked),
  removeReportFile: (applicantId: number, path: string) => S.removeReportFile(db, fileStore, applicantId, path),
  clearReport: (applicantId: number) => S.clearReport(db, fileStore, applicantId),
  saveBackground: (applicantId: number, form: Parameters<typeof S.saveBackgroundSheet>[2]) => S.saveBackgroundSheet(db, applicantId, form),
  chooseBackgroundOutcome: (applicantId: number, form: Parameters<typeof S.chooseBackgroundOutcome>[2], outcome: 'continue' | 'withdraw') =>
    S.chooseBackgroundOutcome(db, applicantId, form, outcome),
  /** Browser / mail app; false when refused or nothing can open it (screen shows a snackbar). */
  openUrl: (url: string) => openExternal(expoVerifyNative, url),
  pick: expoVerifyNative.pick,
};
