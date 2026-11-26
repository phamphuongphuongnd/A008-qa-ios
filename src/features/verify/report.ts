/**
 * S-13 Screening report (external) — pure form logic: DB row ↔ form, validation, the patch to save, company fields the
 * FCRA letter needs, outside-service links. Conventions follow src/engine/README.md: `evictions` [] = None found /
 * null = not entered; `landlordCollectionsCents` 0 = None / null = not entered. Criminal history is never here (S-14).
 * product.md §3.5, §3.7, §3.10, §3.15, §5 S-13.
 */
import type { CompanyField, EvictionCase, EvictionOutcome, IsoDate } from '@/engine';
import type { NewReport, Patch, Report } from '@/db/types';

import { isIsoDate, moneyInputText, parseMoneyInput, type FieldError } from './common';

/** Where the report came from. 'applicant_copy' = "The applicant already has a recent report (30 days or less)". */
export type ReportService = 'mysmartmove' | 'checkr' | 'other' | 'applicant_copy';
export const REPORT_SERVICES: readonly ReportService[] = ['mysmartmove', 'checkr', 'other', 'applicant_copy'];

/**
 * "Open MySmartMove" / "Open Checkr" / "Other service": plain https links opened in the browser. Nothing is sent and
 * no applicant data goes into the URL. The applicant pays and enters their SSN on the company's site.
 */
export const SERVICE_URLS: Record<'mysmartmove' | 'checkr' | 'other', string> = {
  mysmartmove: 'https://www.mysmartmove.com/',
  checkr: 'https://checkr.com/',
  other: 'https://www.google.com/search?q=tenant%20screening%20report',
};

/** A report the applicant brings must be 30 days old or less (product.md S-13). */
export const RECENT_REPORT_DAYS = 30;
export const MAX_KEY_FACTORS = 4;

export const EVICTION_OUTCOMES: readonly EvictionOutcome[] = ['judgment', 'settled', 'dismissed', 'tenant_won', 'unknown'];

export type Tri = 'not_entered' | 'none' | 'listed';

export interface EvictionCaseForm {
  /** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' — reports often show only the year. */
  date: string;
  outcome: EvictionOutcome | null;
}

export interface ReportForm {
  service: ReportService | null;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  reportDate: IsoDate | null;
  evictionsMode: Tri;
  cases: EvictionCaseForm[];
  collectionsMode: Tri;
  collectionsText: string;
  /** C9 only. */
  scoreText: string;
  noScore: boolean;
  scoreModel: string;
  scoreRange: string;
  scoreDate: IsoDate | null;
  keyFactors: string[];
}

export type ReportField = Exclude<keyof ReportForm, 'cases'> | `cases.${number}.date` | `cases.${number}.outcome` | `keyFactors.${number}`;

export function emptyReportForm(): ReportForm {
  return {
    service: null,
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    reportDate: null,
    evictionsMode: 'not_entered',
    cases: [],
    collectionsMode: 'not_entered',
    collectionsText: '',
    scoreText: '',
    noScore: false,
    scoreModel: '',
    scoreRange: '',
    scoreDate: null,
    keyFactors: [],
  };
}

export function toReportForm(r: Report | null): ReportForm {
  if (!r) return emptyReportForm();
  const ev = r.evictions;
  const col = r.landlordCollectionsCents;
  return {
    service: (REPORT_SERVICES as readonly string[]).includes(r.service ?? '') ? (r.service as ReportService) : null,
    companyName: r.companyName ?? '',
    companyAddress: r.companyAddress ?? '',
    companyPhone: r.companyPhone ?? '',
    reportDate: r.reportDate,
    evictionsMode: ev == null ? 'not_entered' : ev.length === 0 ? 'none' : 'listed',
    cases: (ev ?? []).map((c) => ({ date: c.date, outcome: c.outcome })),
    collectionsMode: col == null ? 'not_entered' : col === 0 ? 'none' : 'listed',
    collectionsText: col ? moneyInputText(col) : '',
    scoreText: r.score == null ? '' : String(r.score),
    noScore: r.noScore,
    scoreModel: r.scoreModel ?? '',
    scoreRange: r.scoreRange ?? '',
    scoreDate: r.scoreDate,
    keyFactors: r.keyFactors ?? [],
  };
}

const CASE_DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?$/;

/** A case date as written on the report: year, year-month or full date — not in the future. */
export function isCaseDate(v: string, today: IsoDate): boolean {
  if (!CASE_DATE_RE.test(v)) return false;
  if (v.length === 10 && !isIsoDate(v)) return false;
  return v <= today.slice(0, v.length);
}

const parseScore = (s: string) => (/^\d{1,3}$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);

/**
 * Save-time validation in screen order. Company fields are not required to save (the landlord may come back), see
 * `missingCompanyFields`. With C9 on, a score needs model, range, date and ≤ 4 key factors (FCRA score disclosure).
 */
export function validateReportForm(f: ReportForm, opts: { c9Enabled: boolean; today: IsoDate }): FieldError<ReportField>[] {
  const e: FieldError<ReportField>[] = [];
  if (f.reportDate && !isIsoDate(f.reportDate)) e.push({ field: 'reportDate', code: 'date_invalid' });
  else if (f.reportDate && f.reportDate > opts.today) e.push({ field: 'reportDate', code: 'date_future' });
  if (f.evictionsMode === 'listed') {
    if (f.cases.length === 0) e.push({ field: 'evictionsMode', code: 'required' });
    f.cases.forEach((c, i) => {
      if (!c.date.trim()) e.push({ field: `cases.${i}.date`, code: 'required' });
      else if (!isCaseDate(c.date.trim(), opts.today)) e.push({ field: `cases.${i}.date`, code: 'date_invalid' });
      if (!c.outcome) e.push({ field: `cases.${i}.outcome`, code: 'required' });
    });
  }
  if (f.collectionsMode === 'listed') {
    const v = parseMoneyInput(f.collectionsText);
    if (v === null) e.push({ field: 'collectionsText', code: 'required' });
    else if (Number.isNaN(v)) e.push({ field: 'collectionsText', code: 'money_invalid' });
    else if (v === 0) e.push({ field: 'collectionsText', code: 'money_zero' });
  }
  if (opts.c9Enabled && !f.noScore && f.scoreText.trim()) {
    const s = parseScore(f.scoreText);
    if (Number.isNaN(s) || s < 1) e.push({ field: 'scoreText', code: 'score_invalid' });
    if (!f.scoreModel.trim()) e.push({ field: 'scoreModel', code: 'required' });
    if (!f.scoreRange.trim()) e.push({ field: 'scoreRange', code: 'required' });
    if (!f.scoreDate) e.push({ field: 'scoreDate', code: 'required' });
    else if (!isIsoDate(f.scoreDate)) e.push({ field: 'scoreDate', code: 'date_invalid' });
    else if (f.scoreDate > opts.today) e.push({ field: 'scoreDate', code: 'date_future' });
    if (f.keyFactors.filter((k) => k.trim()).length > MAX_KEY_FACTORS) e.push({ field: 'keyFactors', code: 'too_many_factors' });
  }
  return e;
}

/** DB patch for `saveReport` (file paths are managed by the attach / remove actions, not the form). */
export function reportPatch(f: ReportForm, opts: { c9Enabled: boolean }): Patch<Omit<NewReport, 'applicantId'>> {
  const evictions: EvictionCase[] | null =
    f.evictionsMode === 'not_entered'
      ? null
      : f.evictionsMode === 'none'
        ? []
        : f.cases.filter((c) => c.date.trim() && c.outcome).map((c) => ({ date: c.date.trim(), outcome: c.outcome as EvictionOutcome }));
  const col = parseMoneyInput(f.collectionsText);
  const landlordCollectionsCents =
    f.collectionsMode === 'not_entered' ? null : f.collectionsMode === 'none' ? 0 : col === null || Number.isNaN(col) ? null : col;
  const scoreOn = opts.c9Enabled;
  const score = scoreOn && !f.noScore ? parseScore(f.scoreText) : Number.NaN;
  const withScore = scoreOn && (f.noScore || !Number.isNaN(score));
  return {
    service: f.service,
    companyName: f.companyName.trim() || null,
    companyAddress: f.companyAddress.trim() || null,
    companyPhone: f.companyPhone.trim() || null,
    reportDate: f.reportDate,
    evictions,
    landlordCollectionsCents,
    score: Number.isNaN(score) ? null : score,
    noScore: scoreOn && f.noScore,
    scoreModel: withScore ? f.scoreModel.trim() || null : null,
    scoreRange: withScore ? f.scoreRange.trim() || null : null,
    scoreDate: withScore ? f.scoreDate : null,
    keyFactors: withScore && !f.noScore ? f.keyFactors.map((k) => k.trim()).filter(Boolean).slice(0, MAX_KEY_FACTORS) : [],
  };
}

/** Company fields still blank — the Adverse action notice can't be exported without them (engine `noticeRequirement`). */
export function missingCompanyFields(f: Pick<ReportForm, 'companyName' | 'companyAddress' | 'companyPhone'>): CompanyField[] {
  const out: CompanyField[] = [];
  if (!f.companyName.trim()) out.push('name');
  if (!f.companyAddress.trim()) out.push('address');
  if (!f.companyPhone.trim()) out.push('phone');
  return out;
}

/** Whole days between two dates (b − a). */
function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The applicant's own report is older than 30 days (warning on S-13 when service = applicant_copy). */
export function isReportTooOld(reportDate: IsoDate | null, today: IsoDate): boolean {
  return !!reportDate && isIsoDate(reportDate) && daysBetween(reportDate, today) > RECENT_REPORT_DAYS;
}

/** "Has anything been entered?" — S-09 section row shows "—" until then. */
export function hasReportResults(r: Report | null): boolean {
  return !!r && (r.evictions != null || r.landlordCollectionsCents != null || r.score != null || r.noScore);
}
