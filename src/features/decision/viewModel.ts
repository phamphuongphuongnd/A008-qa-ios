/**
 * Screen view-models for 2D (S-09, S-15 – S-19): everything a screen shows or decides (texts, chips, which buttons,
 * enabled / hint, form checks) as pure functions over the loaders in ./review, ./decision, ./letters, ./decisionFile.
 * Screens only lay these out with `@/ui`; Jest tests them without rendering (no @testing-library in this repo).
 *
 * Rules kept here: no total score and no ranking on S-09 / S-17 / S-18 (the "N of M Met" line exists only in the
 * Decision file — Phương 2026-11-26); Compare columns and the queue follow received order.
 */
import {
  activeCriteria,
  formatDate,
  formatUsd,
  type ApplicantStatus,
  type ConditionKind,
  type CriterionCode,
  type DecisionCondition,
  type DecisionInput,
  type DecisionKind,
  type Evidence,
  type LetterKind,
  type Outcome,
  type QueueAction,
  type QueueState,
} from '@/engine';
import type { SentMethod } from '@/db/schema';
import { verifyProgress } from '@/features/verify/progress';
import { t } from '@/i18n';
import { conditionText, letterReason, letterTitle, type LetterInput } from '@/pdf/letters';
import type { DecisionFileInput } from '@/pdf/decisionFile';
import { routes } from '@/routes';

import { STATUS_AFTER, type DecisionContext, type DecisionPreview, type MissingInfoMethod } from './decision';
import type { LetterContext } from './letters';
import { ISSUE_ACTION_KEYS, evidenceDetail, issueHref, shortName, type ApplicantReview, type CompareData, type EvidenceDetail, type QueueRow } from './review';
import { localIso, shortStamp } from './time';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type ChipTone = 'neutral' | 'accent' | 'warn' | 'outline' | 'solid';

const STATUS_TONE: Record<ApplicantStatus, ChipTone> = {
  new: 'outline',
  in_review: 'accent',
  conditional_offer: 'accent',
  approved: 'solid',
  denied: 'neutral',
  withdrawn: 'neutral',
  incomplete: 'neutral',
  offer_expired: 'neutral',
};

/** Applicant status chip ("In review", "Denied"…). First-come applicants not yet at the front read "Waiting". */
export function statusChip(status: ApplicantStatus, queueState?: QueueState | null): { label: string; tone: ChipTone } {
  if (queueState === 'waiting') return { label: t('decision:status.waiting'), tone: 'outline' };
  return { label: t(`decision:status.${status}`), tone: STATUS_TONE[status] };
}

/** "Received Dec 2, 9:14 AM". */
export const receivedLine = (receivedAt: string) => t('decision:s09.received', { when: shortStamp(receivedAt) });

/** Number of the criterion results that are Met. Decision file only (never S-09 / S-17 / lists, never for sorting). */
export function metCount(results: readonly { outcome: Outcome }[]): { met: number; total: number; text: string } {
  const met = results.filter((r) => r.outcome === 'met').length;
  return { met, total: results.length, text: t('decision:decisionFile.metCount', { met, total: results.length }) };
}

// ---------------------------------------------------------------------------
// S-09 Applicant detail
// ---------------------------------------------------------------------------

export interface CriterionView {
  key: string;
  name: string;
  outcome: Outcome;
  evidence?: Evidence;
  reason: string;
}

export interface IssueView {
  key: string;
  outcome: Outcome;
  evidence?: Evidence;
  title: string;
  detail: string;
  action: { label: string; href: string } | null;
}

export interface SectionView {
  key: string;
  title: string;
  value: string;
  incomplete: boolean;
  /** null → References: several call sheets, the screen opens the list. */
  href: string | null;
  a11y: string;
}

export type DetailFooter =
  | { kind: 'decide'; enabled: boolean; hint: string | null }
  | { kind: 'notice'; label: string; href: string; hint: string }
  | { kind: 'letter'; label: string; href: string }
  | { kind: 'none' };

export interface ApplicantDetailView {
  name: string;
  received: string;
  chip: { label: string; tone: ChipTone };
  /** First-come: "#3 in line". */
  inLine: string | null;
  /** Explains a closed status (withdrawn offer → "Offer withdrawn after background review"). */
  statusNote: string | null;
  summary: { ready: boolean; title: string; subtitle: string };
  issues: { title: string; items: IssueView[] } | null;
  criteria: CriterionView[];
  sections: SectionView[];
  footer: DetailFooter;
  menu: { edit: boolean; withdrawn: boolean; delete: boolean };
}

export function applicantDetailView(r: ApplicantReview): ApplicantDetailView {
  const results = new Map(r.evaluation.results.map((x) => [x.criterionId, x]));
  const status = r.applicant.status;
  const latest = r.latestDecision;
  const items: IssueView[] = r.evaluation.issues.map((issue, i) => {
    const result = results.get(issue.criterionId);
    return {
      key: `${issue.criterionId}:${issue.kind}:${i}`,
      outcome: issue.kind === 'missing' ? 'missing' : issue.kind === 'needs_review' ? 'needs_review' : issue.outcome,
      evidence: issue.kind === 'mismatch' ? 'mismatch' : undefined,
      title: issue.message,
      detail: result?.title ?? '',
      action: { label: t(`decision:${ISSUE_ACTION_KEYS[issue.action]}` as 'decision:issueAction.addReport'), href: issueHref(issue.action, r.applicant) },
    };
  });

  return {
    name: r.bundle.applicant.fullName,
    received: receivedLine(r.bundle.applicant.receivedAt),
    chip: statusChip(status, r.queueEntry?.state ?? null),
    inLine: r.queueEntry ? t('decision:s09.inLine', { n: r.queueEntry.position }) : null,
    statusNote: latest?.kind === 'withdraw_offer' && status === 'denied' ? t('decision:s09.offerWithdrawnNote') : null,
    summary: { ready: r.evaluation.summary.ready, title: r.evaluation.summary.text, subtitle: t('decision:s09.notScore') },
    issues: items.length ? { title: t('decision:s09.issuesTitle', { count: items.length }), items } : null,
    criteria: r.evaluation.results.map((x) => ({
      key: x.criterionId,
      name: x.title,
      outcome: x.outcome,
      evidence: x.evidence ?? undefined,
      reason: x.reason,
    })),
    sections: r.sections.map((s) => {
      const title = t(`decision:s09.section.${s.key}`);
      const value = sectionValue(s.key, s.status);
      return { key: s.key, title, value, incomplete: s.incomplete, href: s.href, a11y: value ? `${title}, ${value}` : title };
    }),
    footer: detailFooter(r),
    menu: {
      edit: !r.bundle.applicant.deletedAt,
      withdrawn: !r.bundle.applicant.deletedAt && !['denied', 'withdrawn', 'incomplete', 'offer_expired', 'approved'].includes(status),
      delete: !r.bundle.applicant.deletedAt,
    },
  };
}

/** Section values stay in the loader's words except the em dash ("Screening report —"). */
function sectionValue(key: string, status: string): string {
  if (status === '—') return '—';
  const known: Record<string, string> = {
    Draft: t('decision:s09.sectionValue.draft'),
    Received: t('decision:s09.sectionValue.received'),
    Entered: t('decision:s09.sectionValue.entered'),
    'After offer': t('decision:s09.sectionValue.afterOffer'),
    Reviewed: t('decision:s09.sectionValue.reviewed'),
    'To review': t('decision:s09.sectionValue.toReview'),
  };
  return known[status] ?? status;
}

export function detailFooter(r: ApplicantReview): DetailFooter {
  const id = r.bundle.applicant.id;
  if (r.bundle.applicant.deletedAt) return { kind: 'none' };
  const pending = r.bundle.decisions.filter((d) => d.noticeStatus === 'pending').pop();
  if (pending) {
    return {
      kind: 'notice',
      label: t('decision:s09.createNotice'),
      href: String(routes.letter(id, { decisionId: pending.id, kind: 'adverse_action' })),
      hint: t('decision:s09.noticePendingHint'),
    };
  }
  const status = r.applicant.status;
  const decidable = status === 'new' || status === 'in_review' || status === 'conditional_offer';
  if (decidable && r.decide.block !== 'closed') {
    return { kind: 'decide', enabled: r.decide.allowed, hint: r.decide.allowed ? null : r.decide.message };
  }
  if (r.latestDecision) {
    return { kind: 'letter', label: t('decision:s09.openLetter'), href: String(routes.letter(id, { decisionId: r.latestDecision.id })) };
  }
  return { kind: 'none' };
}

/** References section → list of call sheets (S-11 per rented residence, S-12 per employer). */
export interface ReferenceLink {
  key: string;
  title: string;
  subtitle: string;
  href: string;
}

export function referenceLinks(r: Pick<ApplicantReview, 'bundle'>): ReferenceLink[] {
  const vp = verifyProgress(r.bundle);
  const id = r.bundle.applicant.id;
  const status = (s: string, attempts: number) =>
    [t(`decision:refStatus.${s}` as 'decision:refStatus.answered'), attempts ? t('decision:refStatus.attempts', { count: attempts }) : null]
      .filter(Boolean)
      .join(' · ');
  return [
    ...vp.landlord.map((l) => ({
      key: `l${l.residenceId}`,
      title: t('decision:s09.landlordRef', { address: l.address || '—' }),
      subtitle: status(l.status, l.attempts),
      href: String(routes.landlordReference(id, l.residenceId)),
    })),
    ...vp.employer.map((e) => ({
      key: `e${e.incomeId}`,
      title: t('decision:s09.employerRef', { employer: e.employer || '—' }),
      subtitle: status(e.status, e.attempts),
      href: String(routes.employerReference(id, e.incomeId)),
    })),
  ];
}

/** Evidence sheet (criterion tap on S-09): source, date, who checked, files, the button to the place to add more. */
export interface EvidenceSheetView {
  title: string;
  outcome: Outcome;
  evidence?: Evidence;
  reason: string;
  rows: { label: string; value: string }[];
  issues: string[];
  action: { label: string; href: string } | null;
}

export function evidenceSheetView(d: EvidenceDetail): EvidenceSheetView {
  const r = d.result;
  const rows: { label: string; value: string }[] = [];
  if (r.source) rows.push({ label: t('decision:evidenceSheet.source'), value: t(`decision:source.${r.source}`) });
  if (r.income) {
    rows.push({ label: t('decision:evidenceSheet.income'), value: t('decision:evidenceSheet.perMonth', { amount: formatUsd(r.income.householdCents) }) });
    rows.push({ label: t('decision:evidenceSheet.rentForTest'), value: t('decision:evidenceSheet.perMonth', { amount: formatUsd(r.income.rentForTestCents) }) });
  }
  if (r.verifiedOn) {
    rows.push({
      label: t('decision:evidenceSheet.checked'),
      value: d.checkedBy ? t('decision:evidenceSheet.checkedByYou', { date: formatDate(r.verifiedOn) }) : formatDate(r.verifiedOn),
    });
  }
  if (d.documents.length) rows.push({ label: t('decision:evidenceSheet.files'), value: t('decision:evidenceSheet.fileCount', { count: d.documents.length }) });
  return {
    title: r.title,
    outcome: r.outcome,
    evidence: r.evidence ?? undefined,
    reason: r.reason,
    rows,
    issues: d.issues.map((i) => i.message),
    action: d.action ? { label: t(`decision:${ISSUE_ACTION_KEYS[d.action.action]}` as 'decision:issueAction.addReport'), href: d.action.href } : null,
  };
}

// ---------------------------------------------------------------------------
// S-15 Decision sheet
// ---------------------------------------------------------------------------

const KINDS: readonly DecisionKind[] = ['conditional_offer', 'approve', 'approve_with_conditions', 'deny', 'withdraw_offer'];
export const CONDITION_KINDS: readonly ConditionKind[] = ['higher_deposit', 'cosigner', 'higher_rent'];
/** Kinds whose reasons are required (product.md S-15). */
const REASONS_REQUIRED: ReadonlySet<DecisionKind> = new Set(['deny', 'approve_with_conditions', 'withdraw_offer']);

/** `?kind=` from `routes.decision(id, { kind })` (e.g. S-14 "Withdraw the offer"). */
export function parseDecisionKind(v: string | string[] | undefined): DecisionKind | null {
  const s = Array.isArray(v) ? v[0] : v;
  return KINDS.includes(s as DecisionKind) ? (s as DecisionKind) : null;
}

export interface DecisionForm {
  kind: DecisionKind | null;
  conditions: Record<ConditionKind, { on: boolean; amountCents: number | null }>;
  /** Ticked reason criterion ids. */
  reasonIds: string[];
  note: string;
  reportInfluenced: boolean;
}

/** Empty form; preselects `kind` only when it is offered for this applicant now. */
export function initialDecisionForm(ctx: DecisionContext, kind: DecisionKind | null = null): DecisionForm {
  return {
    kind: kind && ctx.options.includes(kind) ? kind : null,
    conditions: {
      higher_deposit: { on: false, amountCents: null },
      cosigner: { on: false, amountCents: null },
      higher_rent: { on: false, amountCents: null },
    },
    reasonIds: [],
    note: '',
    reportInfluenced: ctx.defaultReportInfluenced,
  };
}

export function isDecisionDirty(a: DecisionForm, b: DecisionForm): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Form → engine input (reasons only for kinds that take them; conditions only for "Approve with conditions"). */
export function decisionInputOf(ctx: DecisionContext, form: DecisionForm): DecisionInput | null {
  if (!form.kind) return null;
  const takesReasons = REASONS_REQUIRED.has(form.kind);
  const conditions: DecisionCondition[] =
    form.kind === 'approve_with_conditions'
      ? CONDITION_KINDS.filter((k) => form.conditions[k].on).map((k) =>
          k === 'cosigner' ? { kind: k } : { kind: k, amountCents: form.conditions[k].amountCents },
        )
      : [];
  return {
    kind: form.kind,
    conditions,
    reasons: takesReasons ? ctx.reasonChoices.filter((c) => form.reasonIds.includes(c.reason.criterionId)).map((c) => c.reason) : [],
    note: takesReasons ? form.note : '',
    reportInfluenced: REASONS_REQUIRED.has(form.kind) ? form.reportInfluenced : false,
  };
}

export interface DecisionFormView {
  options: { kind: DecisionKind; title: string; description?: string; selected: boolean }[];
  /** Approve with conditions. */
  conditions: { kind: ConditionKind; label: string; on: boolean; amountCents: number | null; needsAmount: boolean; error: string | null }[] | null;
  reasons: { required: boolean; items: { id: string; title: string; description: string; on: boolean }[]; error: string | null } | null;
  /** The §3.15 box, shown for Deny / conditions / withdraw. */
  showReportBox: boolean;
  warnings: string[];
  /** First error to show after a Save try (not field-bound): turn / C10 / assessment. */
  formError: string | null;
  /** Save is pressable (a kind is chosen); pressing with `errors` shows them. */
  canPress: boolean;
  errors: number;
  /** Letter that will follow ("An adverse action notice will be required"). */
  noticeHint: string | null;
}

const OPTION_DESC: Partial<Record<DecisionKind, string>> = {
  conditional_offer: 'decision:s15.desc.conditional_offer',
  approve_with_conditions: 'decision:s15.desc.approve_with_conditions',
  withdraw_offer: 'decision:s15.desc.withdraw_offer',
};

/** Extra check the engine leaves to the screen: a higher deposit / rent needs its amount ("ghi số"). */
function amountErrors(form: DecisionForm): Partial<Record<ConditionKind, string>> {
  if (form.kind !== 'approve_with_conditions') return {};
  const out: Partial<Record<ConditionKind, string>> = {};
  for (const k of ['higher_deposit', 'higher_rent'] as const) {
    const c = form.conditions[k];
    if (c.on && !(c.amountCents != null && c.amountCents > 0)) out[k] = t('decision:s15.amountRequired');
  }
  return out;
}

export function decisionFormView(ctx: DecisionContext, form: DecisionForm, preview: DecisionPreview | null): DecisionFormView {
  const kind = form.kind;
  const errs = preview?.errors ?? [];
  const reasonErr = errs.find((e) => e.code === 'reasons_required' || e.code === 'prohibited_terms') ?? null;
  const condErr = errs.find((e) => e.code === 'conditions_required') ?? null;
  const other = errs.find((e) => e !== reasonErr && e !== condErr) ?? null;
  const amounts = amountErrors(form);
  const byId = new Map(ctx.reasonChoices.map((c) => [c.reason.criterionId, c]));
  return {
    options: ctx.options.map((k) => ({
      kind: k,
      title: t(`decision:decisionKind.${k}`),
      description: OPTION_DESC[k] ? t(OPTION_DESC[k] as 'decision:s15.desc.withdraw_offer') : undefined,
      selected: kind === k,
    })),
    conditions:
      kind === 'approve_with_conditions'
        ? CONDITION_KINDS.map((k) => ({
            kind: k,
            label: t(`decision:conditions.${k}`),
            on: form.conditions[k].on,
            amountCents: form.conditions[k].amountCents,
            needsAmount: k !== 'cosigner',
            error: amounts[k] ?? null,
          }))
        : null,
    reasons:
      kind && REASONS_REQUIRED.has(kind)
        ? {
            required: true,
            items: [...byId.values()].map((c) => ({
              id: c.reason.criterionId,
              title: c.result.title,
              description: reasonDescription(c.result.outcome, c.result.evidence, c.result.source, c.result.reason),
              on: form.reasonIds.includes(c.reason.criterionId),
            })),
            error: reasonErr ? reasonErr.message : condErr ? null : null,
          }
        : null,
    showReportBox: !!kind && REASONS_REQUIRED.has(kind),
    warnings: kind === 'deny' ? (preview?.warnings ?? []) : [],
    formError: other?.message ?? (condErr ? condErr.message : null),
    canPress: !!kind,
    errors: errs.length + Object.keys(amounts).length,
    noticeHint: preview?.notice.adverseAction ? t('decision:s15.noticeHint') : null,
  };
}

/** "Not met · Screening report · Collections owed to a landlord: $2,310". */
export function reasonDescription(outcome: Outcome, evidence: Evidence | null, source: string | null, reason: string): string {
  const parts = [t(`decision:outcome.${outcome}`)];
  if (source) parts.push(t(`decision:source.${source}` as 'decision:source.application'));
  else if (evidence) parts.push(t(`decision:evidence.${evidence}`));
  return `${parts.join(' · ')} — ${reason}`;
}

/** Toggle a reason tick. */
export function toggleReason(form: DecisionForm, id: string, on: boolean): DecisionForm {
  const set = new Set(form.reasonIds);
  if (on) set.add(id);
  else set.delete(id);
  return { ...form, reasonIds: [...set] };
}

/** Pick a kind; switching kinds keeps the reasons / note (the landlord may come back). */
export function chooseKind(form: DecisionForm, kind: DecisionKind): DecisionForm {
  return { ...form, kind };
}

/** "Deny · Dec 6, 3:12 PM" (S-15 notice dialog, snackbar). */
export function savedSummary(kind: DecisionKind, at: string): string {
  return `${t(`decision:decisionKind.${kind}`)} · ${shortStamp(at)}`;
}

/** After "Save decision": the status the applicant moves to (for the snackbar). */
export const statusAfterLabel = (kind: DecisionKind) => t(`decision:status.${STATUS_AFTER[kind]}`);

// ---------------------------------------------------------------------------
// S-16 Letter
// ---------------------------------------------------------------------------

export const SENT_METHODS: readonly SentMethod[] = ['email', 'text', 'mail', 'in_person'];

/** `?kind=` → one of the kinds this decision allows (required one first). */
export function pickLetterKind(kinds: readonly LetterKind[], param: string | string[] | undefined): LetterKind {
  const s = Array.isArray(param) ? param[0] : param;
  return kinds.includes(s as LetterKind) ? (s as LetterKind) : kinds[0];
}

export interface LetterPaper {
  dateText: string;
  recipient: string[];
  re: string;
  dear: string;
  opening: string;
  conditions: string[];
  reasons: { label: string; items: string[] } | null;
  replyBy: string | null;
  score: string[] | null;
  /** The locked FCRA block: company lines + required sentences. */
  fcra: { company: string[]; lines: string[] } | null;
  closing: string;
  signOff: string[];
}

/** The on-screen letter (same parts and order as the PDF in src/pdf/letters.ts). */
export function letterPaper(input: LetterInput): LetterPaper {
  const reasons = input.reasons.map(letterReason);
  const showsReasons = input.kind === 'adverse_action' || input.kind === 'denial';
  let reasonBlock: LetterPaper['reasons'] = null;
  if (showsReasons) {
    if (reasons.length === 1) reasonBlock = { label: t('decision:letters.reasonLabel'), items: [`${reasons[0]}.`] };
    else if (reasons.length > 1) reasonBlock = { label: t('decision:letters.reasonsLabel'), items: reasons };
    else if (input.note?.trim()) reasonBlock = { label: t('decision:letters.reasonLabel'), items: [input.note.trim()] };
  }
  const s = input.data.scoreBlock;
  let score: string[] | null = null;
  if (s) {
    score = [t('decision:letters.score.heading')];
    if (s.noScore || s.score == null) score.push(t('decision:letters.score.none'));
    else {
      score.push(`${t('decision:letters.score.value', { score: s.score })}${s.range ? ` ${t('decision:letters.score.range', { range: s.range })}` : ''}`);
      if (s.date) score.push(t('decision:letters.score.date', { date: formatDate(s.date) }));
      if (s.model) score.push(t('decision:letters.score.model', { model: s.model }));
    }
    if (s.keyFactors.length) score.push(t('decision:letters.score.factors'), ...s.keyFactors.map((k) => `• ${k}`));
  }
  const c = input.data.company;
  return {
    dateText: input.dateText,
    recipient: [input.recipient.name, input.recipient.address ?? ''].filter(Boolean),
    re: t('decision:letters.re', { address: input.rentalAddress }),
    dear: t('decision:letters.dear', { name: input.recipient.name }),
    opening: input.opening,
    conditions: input.conditions.map(conditionText),
    reasons: reasonBlock,
    replyBy: input.data.respondBy && input.respondByText ? t('decision:letters.replyBy', { when: input.respondByText }) : null,
    score,
    fcra: input.data.fcraLines.length ? { company: c ? [c.name, c.address, c.phone].filter(Boolean) : [], lines: [...input.data.fcraLines] } : null,
    closing: input.closing,
    signOff: [t('decision:letters.signOff'), input.landlord.name || t('decision:s16.yourName'), input.landlord.address ?? '', input.landlord.phone ?? ''].filter(
      Boolean,
    ),
  };
}

export interface LetterScreenView {
  title: string;
  subtitle: string;
  /** Segmented choices when the decision allows two letters (approval with conditions + FCRA notice). */
  kinds: { value: LetterKind; label: string }[] | null;
  /** Adverse notice without the report company → can't share; button to S-13. */
  blocked: { message: string; href: string } | null;
  landlordNameMissing: boolean;
  /** Already marked as sent: "Sent Dec 6, 2026 · Email". */
  sent: string | null;
  canShare: boolean;
  canMarkSent: boolean;
  markLabel: string;
}

export function letterScreenView(ctx: LetterContext, kind: LetterKind, method: SentMethod | null, today: string): LetterScreenView {
  const letter = ctx.decisionRow.letters.filter((l) => l.kind === kind).pop() ?? null;
  const blocked = kind === 'adverse_action' && ctx.blockedHref ? { message: t('decision:s16.companyMissing'), href: ctx.blockedHref } : null;
  const isFcra = kind === 'adverse_action';
  return {
    title: letterTitle(kind),
    subtitle: isFcra ? t('decision:s16.fcraSubtitle', { name: ctx.bundle.applicant.fullName }) : ctx.bundle.applicant.fullName,
    kinds: ctx.kinds.length > 1 ? ctx.kinds.map((k) => ({ value: k, label: letterTitle(k) })) : null,
    blocked,
    landlordNameMissing: ctx.landlordNameMissing,
    sent:
      letter?.sentAt != null
        ? t('decision:s16.sentOn', {
            date: formatDate(letter.sentAt.slice(0, 10)),
            method: letter.sentMethod ? t(`decision:sentMethod.${letter.sentMethod}`) : '—',
          })
        : null,
    canShare: !blocked,
    canMarkSent: !blocked && method != null,
    markLabel: t('decision:s16.markSentOn', { date: formatDate(today).replace(/, \d{4}$/, '') }),
  };
}

// ---------------------------------------------------------------------------
// S-17 Compare
// ---------------------------------------------------------------------------

export interface CompareViewColumn {
  key: string;
  title: string;
  subtitle: string;
}

export type CompareViewCell = { outcome: Outcome; evidence?: Evidence } | { text: string; tone: 'warn' | 'muted'; bold: boolean };

export interface CompareView {
  state: 'empty' | 'all_hidden' | 'table';
  columns: CompareViewColumn[];
  rows: { key: string; label: string; bold?: boolean; cells: Record<string, CompareViewCell> }[];
}

/** S-17: columns in received order (never re-sorted), last row "Issues". */
export function compareView(d: CompareData): CompareView {
  if (!d.enough) return { state: 'empty', columns: [], rows: [] };
  const cols = d.table.columns.map((c) => ({ key: c.applicantId, title: shortName(c.fullName), subtitle: shortStamp(c.receivedAt) }));
  if (!cols.length) return { state: 'all_hidden', columns: [], rows: [] };
  const rows: CompareView['rows'] = d.table.rows.map((r) => ({
    key: r.criterionId,
    label: r.title,
    cells: Object.fromEntries(
      r.cells.map((cell, i) => [cols[i].key, cell.evidence ? { outcome: cell.outcome, evidence: cell.evidence } : { outcome: cell.outcome }]),
    ),
  }));
  rows.push({
    key: 'issues',
    label: t('decision:s17.issuesRow'),
    bold: true,
    cells: Object.fromEntries(d.table.issueCounts.map((n, i) => [cols[i].key, { text: String(n), tone: n > 0 ? 'warn' : 'muted', bold: n > 0 }])),
  });
  return { state: 'table', columns: cols, rows };
}

/** What a tap on an S-17 cell opens. */
export type CompareTap = { kind: 'evidence'; sheet: EvidenceSheetView } | { kind: 'applicant'; href: string } | null;

/**
 * S-17 tap on a cell (product.md §5 S-17 "Chạm ô → sheet chứng cứ"): a criterion cell opens that applicant's evidence
 * sheet — the same one as S-09, titled "Jordan E. · Income ≥ 3.0×"; the "Issues" row opens S-09 (where issues are fixed).
 */
export function compareCellTap(d: CompareData, rowKey: string, applicantId: string): CompareTap {
  const i = d.table.columns.findIndex((c) => c.applicantId === applicantId);
  if (i < 0) return null;
  const bundle = d.bundles[i];
  if (rowKey === 'issues') return { kind: 'applicant', href: String(routes.applicant(bundle.applicant.id)) };
  const result = d.table.evaluations[i]?.results.find((r) => r.criterionId === rowKey);
  if (!result) return null;
  const sheet = evidenceSheetView(evidenceDetail(result, bundle, d.applicants[i]));
  return { kind: 'evidence', sheet: { ...sheet, title: t('decision:s17.sheetTitle', { name: shortName(d.table.columns[i].fullName), criterion: sheet.title }) } };
}

// ---------------------------------------------------------------------------
// S-18 Order queue
// ---------------------------------------------------------------------------

export interface QueueButton {
  action: QueueAction;
  label: string;
  variant: 'primary' | 'secondary';
}

export interface QueueRowView {
  key: string;
  rowId: number;
  n: number;
  active: boolean;
  name: string;
  /** "Dec 1, 9:40 AM · In review". */
  line: string;
  timer: { label: string; calm: boolean } | null;
  buttons: QueueButton[];
  a11y: string;
}

const QUEUE_BUTTON: Record<QueueAction, { key: string; variant: 'primary' | 'secondary' }> = {
  review: { key: 'decision:s18.review', variant: 'primary' },
  request_missing_info: { key: 'decision:s18.requestMissing', variant: 'secondary' },
  move_to_next_incomplete: { key: 'decision:s18.moveNextIncomplete', variant: 'secondary' },
  offer_expired_move_next: { key: 'decision:s18.offerExpiredMoveNext', variant: 'primary' },
};

export function queueRowView(row: QueueRow, currentId: string | null): QueueRowView {
  const status = row.state === 'waiting' ? t('decision:status.waiting') : t(`decision:status.${row.status}`);
  const line = `${shortStamp(row.receivedAt)} · ${status}`;
  // An expired offer leaves one way on (mockup S-18); the row itself still opens S-09.
  const actions = row.actions.includes('offer_expired_move_next') ? (['offer_expired_move_next'] as QueueAction[]) : row.actions;
  const timer = row.timer && row.timer.status !== 'resolved' ? { label: row.timer.label, calm: false } : null;
  return {
    key: row.applicantId,
    rowId: row.rowId,
    n: row.position,
    active: row.applicantId === currentId,
    name: row.fullName,
    line,
    timer,
    buttons: actions.map((a) => ({ action: a, label: t(QUEUE_BUTTON[a].key as 'decision:s18.review'), variant: QUEUE_BUTTON[a].variant })),
    a11y: [t('ui:queue.position', { n: row.position }), row.fullName, line, timer?.label].filter(Boolean).join(', '),
  };
}

export const MISSING_INFO_METHODS: readonly MissingInfoMethod[] = ['email', 'text', 'call', 'in_person'];

/** "Request missing info" sheet: ends in 72 h from now ("Ends Dec 9, 9:40 AM"), the Missing items, the methods. */
export function missingInfoSheet(row: QueueRow, now: Date): { endsText: string; missing: string[] } {
  const end = new Date(now.getTime() + 72 * 3_600_000);
  return { endsText: t('decision:s18.ends', { when: shortStamp(localIso(end)) }), missing: row.missing };
}

// ---------------------------------------------------------------------------
// S-19 Decision file (on-screen summary of the PDF)
// ---------------------------------------------------------------------------

export interface DecisionFilePreview {
  title: string;
  subtitle: string;
  history: string[];
  applicants: { key: string; heading: string; lines: string[]; deleted: boolean }[];
}

export function decisionFilePreview(input: DecisionFileInput): DecisionFilePreview {
  return {
    title: t('decision:decisionFile.title'),
    subtitle: t('decision:decisionFile.exported', { address: input.rentalShortAddress, date: input.exportedText }),
    history: input.history.map((h) => [h.atText, ...h.lines, h.reason ? `“${h.reason}”` : ''].filter(Boolean).join(' · ')),
    applicants: input.applicants.map((a) => {
      if (a.deleted) return { key: `d${a.position}`, heading: `${a.position}. ${a.deletedText}`, lines: [], deleted: true };
      const last = a.decisions[a.decisions.length - 1];
      const first = [a.metText, last ? last.short : a.summary, ...(last?.reasonCodes.length ? [last.reasonCodes.join(', ')] : [])].join(' · ');
      return {
        key: `a${a.position}`,
        heading: `${a.position}. ${a.name} — ${a.receivedShort}`,
        lines: [first, ...(last?.noticePending ? [t('decision:decisionFile.noticePending')] : []), ...(last?.letters ?? [])],
        deleted: false,
      };
    }),
  };
}

/** Criterion codes of the enabled criteria (for tests / headers). */
export const activeCodes = (criteria: Parameters<typeof activeCriteria>[0]): CriterionCode[] => activeCriteria(criteria).map((c) => c.code);
