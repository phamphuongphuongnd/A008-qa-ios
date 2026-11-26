/**
 * View-models of S-11 … S-14: everything a screen shows or enables that is not layout — texts, which blocks are
 * visible, button states, hints, list rows, where a button goes. Pure (no React / DB), tested in
 * __tests__/viewModels.test.ts; the screens only lay these out with @/ui.
 */
import type { AttemptMethod, AttemptResult } from '@/engine';
import type { Attempt } from '@/db/types';
import { t } from '@/i18n';
import { routes } from '@/routes';

import { backgroundState, type BackgroundForm, type OutcomeBlock } from './background';
import { attemptResultKey, attemptTimeText, localDate, localTimestamp, monthYearOfDate, type FieldError, type VerifyErrorCode } from './common';
import type { EmployerForm } from './employer';
import type { LandlordForm, RedFlagView } from './landlord';
import { MAX_KEY_FACTORS, isReportTooOld, missingCompanyFields, type ReportForm, type Tri } from './report';
import { liveRedFlags, type BackgroundSheet, type EmployerSheet, type LandlordSheet, type ReportSheet } from './service';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const errorText = (code: VerifyErrorCode) => t(`verify:errors.${code}`);

/** First error message for a field, or null. */
export function fieldError<F extends string>(errors: readonly FieldError<F>[], field: F): string | null {
  const e = errors.find((x) => x.field === field);
  return e ? errorText(e.code) : null;
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

export function attemptResultLabel(method: AttemptMethod, result: AttemptResult): string {
  return t(`verify:${attemptResultKey(method, result)}` as 'verify:attempts.result.reached');
}

export interface AttemptRow {
  id: number;
  method: AttemptMethod;
  /** "No answer" · "No reply yet" (email). */
  title: string;
  /** "Call · Dec 3, 10:02 AM". */
  subtitle: string;
}

export function attemptRows(attempts: readonly Attempt[]): AttemptRow[] {
  return attempts.map((a) => ({
    id: a.id,
    method: a.method,
    title: attemptResultLabel(a.method, a.result),
    subtitle: `${t(`verify:attempts.method.${a.method}`)} · ${attemptTimeText(a.at)}`,
  }));
}

/** The card under the attempts list: nothing, "3 tries, 2 ways → Mark as unreachable", or "Marked as unreachable". */
export function unreachableCard(u: LandlordSheet['unreachable']): { kind: 'none' } | { kind: 'can_mark'; title: string } | { kind: 'marked' } {
  if (u.unreachable) return { kind: 'marked' };
  if (u.canMark) return { kind: 'can_mark', title: t('verify:attempts.unreachableHint', { count: u.failedCount, methods: u.methodCount }) };
  return { kind: 'none' };
}

/** "Log attempt" sheet: an attempt on another day is stored at noon local time (today = now). */
export function attemptAt(day: string, now: Date): string {
  if (day === localDate(now)) return localTimestamp(now);
  const [y, m, d] = day.split('-').map(Number);
  return localTimestamp(new Date(y, m - 1, d, 12, 0, 0));
}

/** "Log attempt" sheet: Save enabled once method + result are picked. */
export const canSaveAttempt = (method: AttemptMethod | null, result: AttemptResult | null) => !!method && !!result;

// ---------------------------------------------------------------------------
// S-11
// ---------------------------------------------------------------------------

export interface LandlordView {
  subtitle: string;
  firstName: string;
  q1: string;
  redFlags: RedFlagView[];
  showBothTip: boolean;
  /** Q2 "To" is disabled while "Still there" is ticked. */
  toDisabled: boolean;
  showViolationsNote: boolean;
  showOwesAmount: boolean;
  showRentAgainWhy: boolean;
}

export function landlordView(sheet: LandlordSheet, form: LandlordForm, now = new Date()): LandlordView {
  const name = firstName(sheet.applicant.fullName);
  return {
    subtitle: `${sheet.residence.address} · ${sheet.applicant.fullName}`,
    firstName: name,
    q1: t('verify:landlord.q1', { name, address: sheet.residence.address }),
    redFlags: liveRedFlags(sheet, form, now),
    showBothTip: sheet.showBothLandlordsTip,
    toDisabled: form.to === 'still_there',
    showViolationsNote: form.violations === 'yes',
    showOwesAmount: form.owes === 'yes',
    showRentAgainWhy: !!form.rentAgain && form.rentAgain !== 'yes',
  };
}

/**
 * Q8 "Yes" needs an amount first: it is kept in the form without saving (an empty amount would fail validation);
 * any other answer saves at once. Returns whether the change should be saved now.
 */
export const saveOwesNow = (owes: LandlordForm['owes']) => owes !== 'yes';

// ---------------------------------------------------------------------------
// S-12
// ---------------------------------------------------------------------------

export interface EmployerView {
  subtitle: string;
  q1: string;
  /** "Since when?" + "Job title?" are hidden when the employer says the person doesn't work there. */
  showSinceAndTitle: boolean;
}

export function employerView(sheet: EmployerSheet, form: EmployerForm): EmployerView {
  const employer = sheet.income.employer?.trim() || t('verify:employer.unnamed');
  return {
    subtitle: `${employer} · ${sheet.applicant.fullName}`,
    q1: t('verify:employer.q1', { name: firstName(sheet.applicant.fullName) }),
    showSinceAndTitle: form.employed !== 'no',
  };
}

// ---------------------------------------------------------------------------
// S-13
// ---------------------------------------------------------------------------

export interface ReportFileRow {
  path: string;
  kind: 'pdf' | 'photo';
  title: string;
  removeLabel: string;
}

export interface ReportView {
  subtitle: string;
  showTooOld: boolean;
  showCompanyMissing: boolean;
  /** Segmented values: null = nothing chosen yet ("not entered"). */
  evictionsValue: Exclude<Tri, 'not_entered'> | null;
  collectionsValue: Exclude<Tri, 'not_entered'> | null;
  showCases: boolean;
  showCollectionsAmount: boolean;
  showScoreBlock: boolean;
  showScoreFields: boolean;
  canAddKeyFactor: boolean;
  files: ReportFileRow[];
  showRemoveReport: boolean;
}

const triValue = (v: Tri) => (v === 'not_entered' ? null : v);

export function reportView(sheet: ReportSheet, form: ReportForm, today: string): ReportView {
  return {
    subtitle: sheet.applicant.fullName,
    showTooOld: form.service === 'applicant_copy' && isReportTooOld(form.reportDate, today),
    showCompanyMissing: missingCompanyFields(form).length > 0,
    evictionsValue: triValue(form.evictionsMode),
    collectionsValue: triValue(form.collectionsMode),
    showCases: form.evictionsMode === 'listed',
    showCollectionsAmount: form.collectionsMode === 'listed',
    showScoreBlock: sheet.c9Enabled,
    showScoreFields: sheet.c9Enabled && !form.noScore,
    canAddKeyFactor: form.keyFactors.length < MAX_KEY_FACTORS,
    files: sheet.filePaths.map((path, i) => {
      const pdf = path.toLowerCase().endsWith('.pdf');
      return {
        path,
        kind: pdf ? 'pdf' : 'photo',
        title: t(pdf ? 'verify:report.filePdf' : 'verify:report.filePhoto', { n: i + 1 }),
        removeLabel: t('verify:report.removeFile', { n: i + 1 }),
      };
    }),
    showRemoveReport: !!sheet.report,
  };
}

/** Choosing "Cases listed" with no case yet adds an empty one to fill in. */
export function chooseEvictions(form: ReportForm, v: 'none' | 'listed'): Partial<ReportForm> {
  return { evictionsMode: v, cases: v === 'listed' && form.cases.length === 0 ? [{ date: '', outcome: null }] : form.cases };
}

/** Snackbar text after a picker result (null = nothing to say). */
export function pickMessage(source: 'camera' | 'photos' | 'files', status: 'picked' | 'canceled' | 'denied'): string | null {
  if (status !== 'denied') return null;
  return t(source === 'camera' ? 'verify:report.cameraDenied' : 'verify:report.photosDenied');
}

// ---------------------------------------------------------------------------
// S-14
// ---------------------------------------------------------------------------

export interface ConvictionCard {
  index: number;
  title: string;
  /** Needs review (inside the lookback) · outside (older, not considered) · null (incomplete entry). */
  badge: 'needs_review' | 'outside' | null;
  outsideLabel: string;
  /** "Convicted Jun 2020 · sentence completed Dec 2020" (empty until the conviction date is set). */
  line: string;
}

export type BackgroundView =
  | { kind: 'empty'; subtitle: string; icon: 'lock' | 'off'; title: string; body: string }
  | {
      kind: 'review';
      subtitle: string;
      editable: boolean;
      readOnly: boolean;
      modeLabel: string;
      noneA11y: string;
      modeValue: 'none' | 'listed' | null;
      cards: ConvictionCard[];
      showAssessment: boolean;
      /** "6 years, 6 months (calculated)" for the latest conviction in the lookback. */
      howLongAgo: string;
      showNoneInLookback: boolean;
      footer: { show: boolean; continueDisabled: boolean; showWithdraw: boolean; withdrawDisabled: boolean; hint: string | undefined };
    };

const blockHint = (b: OutcomeBlock | null) => (b && b !== 'not_editable' ? t(`verify:background.block.${b}`) : undefined);

export function backgroundView(sheet: BackgroundSheet, form: BackgroundForm, today: string): BackgroundView {
  const { gate, applicant, lookbackYears } = sheet;
  if (gate === 'locked' || gate === 'not_in_criteria') {
    const locked = gate === 'locked';
    return {
      kind: 'empty',
      subtitle: applicant.fullName,
      icon: locked ? 'lock' : 'off',
      title: t(locked ? 'verify:background.lockedTitle' : 'verify:background.offTitle'),
      body: t(locked ? 'verify:background.lockedBody' : 'verify:background.offBody'),
    };
  }
  const state = backgroundState(form, { gate, lookbackYears, conditionalOfferAt: sheet.conditionalOfferAt, today });
  const editable = gate === 'open';
  const cards: ConvictionCard[] = form.mode === 'listed'
    ? form.convictions.map((c, index) => {
        const v = state.convictions.find((x) => x.conviction.convictedOn === c.convictedOn && x.conviction.type === c.type);
        return {
          index,
          title: c.type ? t(`verify:background.convictionType.${c.type}`) : t('verify:background.convictionN', { n: index + 1 }),
          badge: v ? (v.inLookback ? 'needs_review' : 'outside') : null,
          outsideLabel: t('verify:background.outside', { count: lookbackYears }),
          line: !v
            ? ''
            : c.sentenceEndedOn
              ? t('verify:background.lineWithSentence', { convicted: monthYearOfDate(v.conviction.convictedOn), ended: monthYearOfDate(c.sentenceEndedOn) })
              : t('verify:background.line', { convicted: monthYearOfDate(v.conviction.convictedOn) }),
        };
      })
    : [];
  const latest = state.convictions
    .filter((c) => c.inLookback)
    .sort((a, b) => (a.conviction.convictedOn < b.conviction.convictedOn ? 1 : -1))[0];
  const hint = blockHint(state.withdrawBlock === 'no_convictions_in_lookback' ? null : state.withdrawBlock) ?? blockHint(state.continueBlock);
  return {
    kind: 'review',
    subtitle: t('verify:background.subtitleAfterOffer', { name: applicant.fullName }),
    editable,
    readOnly: gate === 'read_only',
    modeLabel: t('verify:background.convictionsIn', { count: lookbackYears }),
    noneA11y: t('verify:background.noneA11y', { count: lookbackYears }),
    modeValue: form.mode === 'not_entered' ? null : form.mode,
    cards,
    showAssessment: state.needsAssessment,
    howLongAgo: latest ? `${latest.howLongAgo} ${t('verify:background.calculated')}` : '—',
    showNoneInLookback: form.mode === 'listed' && !state.needsAssessment && state.convictions.length > 0,
    footer: {
      show: editable,
      continueDisabled: !!state.continueBlock,
      showWithdraw: state.needsAssessment,
      withdrawDisabled: !!state.withdrawBlock,
      hint,
    },
  };
}

/** Where a successful outcome goes: Withdraw → S-15 with withdraw_offer preselected; Continue → back. */
export function backgroundNext(outcome: 'continue' | 'withdraw', applicantId: number): { kind: 'push'; href: ReturnType<typeof routes.decision> } | { kind: 'back' } {
  return outcome === 'withdraw' ? { kind: 'push', href: routes.decision(applicantId, { kind: 'withdraw_offer' }) } : { kind: 'back' };
}

/** Guide article for "Criminal history laws by city" (slug owned by 2E's guide content). */
export const CRIMINAL_HISTORY_ARTICLE = 'criminal-history';
