/**
 * S-16 Letter service (F-14): which letter a Decision needs, the editable text, export to PDF (share + keep a copy
 * with the applicant's files) and "Mark as sent". The FCRA rules are the engine's (`noticeRequirement`, `letterData`).
 * An Adverse action notice can't be exported while the report company's name / address / phone is blank → S-13.
 */
import {
  criterionTitle,
  letterData,
  noticeRequirement,
  type DecisionInput,
  type LetterData,
  type LetterKind,
  type NoticeRequirement,
  type ScreeningReport,
} from '@/engine';
import { getApplicantBundle, type ApplicantBundle } from '@/db/repos/applicants';
import { createLetter, getLetter, markLetterSent, updateLetter } from '@/db/repos/decisions';
import { listCriteria } from '@/db/repos/criteria';
import { getRental } from '@/db/repos/rentals';
import { getSettings } from '@/db/repos/settings';
import { toDecisionInput, toEngineApplicant, toEngineCriteria } from '@/db/toEngine';
import type { SentMethod } from '@/db/schema';
import type { AppDb, Decision, Letter, Rental } from '@/db/types';
import type { SavedFile, SaveOptions } from '@/files';
import { defaultLetterText, letterFileName, letterHtml, type LetterInput } from '@/pdf/letters';
import { printToPdfAndShare, type PdfAdapter } from '@/pdf/shell';
import { routes } from '@/routes';

import type { ActionResult } from './decision';
import { applicantAddress, rentalAddress } from './review';
import { localDate, localDateTime, localIso, longDate } from './time';

export interface LetterBody {
  opening: string;
  closing: string;
}

/** letters.body holds the two editable paragraphs as JSON. */
export function encodeLetterBody(b: LetterBody): string {
  return JSON.stringify({ opening: b.opening, closing: b.closing });
}

export function decodeLetterBody(body: string | null | undefined): LetterBody | null {
  if (!body) return null;
  try {
    const x = JSON.parse(body) as Partial<LetterBody>;
    return typeof x.opening === 'string' ? { opening: x.opening, closing: typeof x.closing === 'string' ? x.closing : '' } : null;
  } catch {
    return { opening: body, closing: '' };
  }
}

/** Letter kinds the landlord can create for a Decision (the required one first). */
export function letterKindsFor(decision: DecisionInput, notice: NoticeRequirement): LetterKind[] {
  if (notice.adverseAction) return decision.kind === 'approve_with_conditions' ? ['adverse_action', 'approval'] : ['adverse_action'];
  return [notice.letter];
}

export interface LetterContext {
  rentalRow: Rental;
  bundle: ApplicantBundle;
  decisionRow: Decision & { letters: Letter[] };
  decision: DecisionInput;
  report: ScreeningReport | null;
  notice: NoticeRequirement;
  kinds: LetterKind[];
  /** Report company fields to fill in S-13 first (adverse action only). */
  blockedHref: string | null;
  landlord: { name: string; address: string; phone: string };
  /** Settings has no landlord name yet (letters are signed with it) → link to Settings. */
  landlordNameMissing: boolean;
  /** Criterion id (engine) → title, for custom-criterion reasons. */
  titles: Map<string, string>;
}

/** S-16 data for a decision (the latest one when `decisionId` is null). */
export function loadLetterContext(db: AppDb, applicantId: number, decisionId: number | null): LetterContext | null {
  const bundle = getApplicantBundle(db, applicantId);
  if (!bundle) return null;
  const decisionRow = decisionId == null ? bundle.decisions[bundle.decisions.length - 1] : bundle.decisions.find((d) => d.id === decisionId);
  const rentalRow = getRental(db, bundle.applicant.rentalId);
  if (!decisionRow || !rentalRow) return null;
  const decision = toDecisionInput(decisionRow);
  const report = toEngineApplicant(bundle).report;
  const notice = noticeRequirement(decision, report);
  const s = getSettings(db);
  return {
    rentalRow,
    bundle,
    decisionRow,
    decision,
    report,
    notice,
    kinds: letterKindsFor(decision, notice),
    blockedHref: notice.adverseAction && !notice.canExport ? String(routes.screeningReport(applicantId)) : null,
    landlord: { name: s.landlordName.trim(), address: s.landlordAddress.trim(), phone: s.landlordPhone.trim() },
    landlordNameMissing: !s.landlordName.trim(),
    titles: new Map(toEngineCriteria(listCriteria(db, rentalRow.id)).map((c) => [c.id, criterionTitle(c)])),
  };
}

/** The saved letter of a kind for this decision, if any (latest). */
export function existingLetter(ctx: LetterContext, kind: LetterKind): Letter | null {
  const list = ctx.decisionRow.letters.filter((l) => l.kind === kind);
  return list[list.length - 1] ?? null;
}

/** Text to show in the editor: the saved paragraphs, else the defaults. */
export function letterText(ctx: LetterContext, kind: LetterKind): LetterBody {
  return decodeLetterBody(existingLetter(ctx, kind)?.body) ?? defaultLetterText(kind, ctx.decision.kind, rentalAddress(ctx.rentalRow).full);
}

/** Everything the PDF prints, for a kind and the edited paragraphs. `today` = local `YYYY-MM-DD`. */
export function buildLetterInput(ctx: LetterContext, kind: LetterKind, body: LetterBody, today: string): LetterInput {
  const data: LetterData = letterData({
    decision: ctx.decision,
    report: ctx.report,
    reviewMode: ctx.rentalRow.reviewMode,
    decidedAt: ctx.decisionRow.at,
  });
  // A kind other than the required one (approval letter next to an adverse notice) carries no FCRA block.
  const fixed: LetterData = kind === data.letter ? data : { ...data, letter: kind, company: null, scoreBlock: null, fcraLines: [] };
  return {
    kind,
    decisionKind: ctx.decision.kind,
    date: today,
    dateText: longDate(today),
    recipient: { name: ctx.bundle.applicant.fullName, address: applicantAddress(ctx.bundle) },
    rentalAddress: rentalAddress(ctx.rentalRow).full,
    landlord: { name: ctx.landlord.name, address: ctx.landlord.address || null, phone: ctx.landlord.phone || null },
    opening: body.opening,
    closing: body.closing,
    reasons: ctx.decision.reasons.map((r) => ({ code: r.code, title: ctx.titles.get(r.criterionId) ?? '' })),
    note: ctx.decision.note,
    conditions: ctx.decision.conditions,
    data: fixed,
    respondByText: fixed.respondBy && (kind === 'conditional_offer' || kind === 'approval') ? localDateTime(fixed.respondBy) : null,
  };
}

export interface LetterDeps {
  db: AppDb;
  now: () => Date;
  files: { saveCopy(o: SaveOptions): Promise<SavedFile> };
  pdf?: PdfAdapter;
}

function guard(ctx: LetterContext, kind: LetterKind): { error: string; message: string } | null {
  if (!ctx.kinds.includes(kind)) return { error: 'wrong_kind', message: 'This letter does not match the decision' };
  if (kind === 'adverse_action' && !ctx.notice.canExport)
    return { error: 'company_missing', message: 'Add the report company’s name, address and phone first' };
  return null;
}

/** Create or update the letter row with its text (adverse notice → decision leaves "Notice pending"). */
function upsertLetter(db: AppDb, ctx: LetterContext, kind: LetterKind, body: LetterBody): number {
  const existing = existingLetter(ctx, kind);
  if (existing) {
    updateLetter(db, existing.id, { body: encodeLetterBody(body) });
    return existing.id;
  }
  return createLetter(db, { decisionId: ctx.decisionRow.id, kind, body: encodeLetterBody(body) });
}

/** The PDF HTML (Preview PDF / tests). */
export function letterDocument(ctx: LetterContext, kind: LetterKind, body: LetterBody, today: string): string {
  return letterHtml(buildLetterInput(ctx, kind, body, today));
}

/** "Share": print the PDF, keep a copy next to the applicant's files, open the share sheet. */
export async function exportLetter(
  deps: LetterDeps,
  input: { applicantId: number; decisionId: number; kind: LetterKind; body: LetterBody },
): Promise<ActionResult<{ letterId: number; uri: string; shared: boolean }>> {
  const ctx = loadLetterContext(deps.db, input.applicantId, input.decisionId);
  if (!ctx) return { ok: false, error: 'not_found', message: 'Decision not found' };
  const blocked = guard(ctx, input.kind);
  if (blocked) return { ok: false, ...blocked };
  const docHtml = letterDocument(ctx, input.kind, input.body, localDate(deps.now()));
  const letterId = upsertLetter(deps.db, ctx, input.kind, input.body);
  const printed = await printToPdfAndShare(docHtml, letterFileName(input.kind, ctx.bundle.applicant.fullName), { adapter: deps.pdf });
  try {
    const saved = await deps.files.saveCopy({
      owner: { applicantId: input.applicantId },
      kind: 'letter',
      sourceUri: printed.uri,
      mime: 'application/pdf',
      id: letterId,
    });
    const old = getLetter(deps.db, letterId)?.pdfPath;
    if (old !== saved.path) updateLetter(deps.db, letterId, { pdfPath: saved.path });
  } catch {
    // The shared PDF still exists in the cache; the record stays without a stored copy.
  }
  return { ok: true, letterId, uri: printed.uri, shared: printed.shared };
}

/** "Mark as sent" (date + how). Saves the letter text first when it was never exported. */
export function markSent(
  deps: Pick<LetterDeps, 'db' | 'now'>,
  input: { applicantId: number; decisionId: number; kind: LetterKind; body: LetterBody; method: SentMethod },
): ActionResult<{ letterId: number; sentAt: string }> {
  const ctx = loadLetterContext(deps.db, input.applicantId, input.decisionId);
  if (!ctx) return { ok: false, error: 'not_found', message: 'Decision not found' };
  const blocked = guard(ctx, input.kind);
  if (blocked) return { ok: false, ...blocked };
  const letterId = upsertLetter(deps.db, ctx, input.kind, input.body);
  const sentAt = localIso(deps.now());
  markLetterSent(deps.db, letterId, input.method, sentAt);
  return { ok: true, letterId, sentAt };
}
