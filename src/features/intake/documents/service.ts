/**
 * Documents (F-07, S-10) + paper-form photos (S-08 part 7). Required types come from the rental's C6; state per type
 * Missing / Provided / Checked uses the engine's `documentProgress`, the income check uses `documentMonthlyCents` +
 * `incomeCheck` (§3.3: below 90 % of the stated amount → Mismatch). Files go through `src/files` (photos compressed,
 * named by id, deleted with the applicant).
 */
import {
  DOC_TYPE_LABELS,
  documentMonthlyCents,
  documentProgress,
  incomeCheck,
  requiredDocLabel,
  type DocType,
  type DocumentInput,
  type IncomeCheck,
  type PayFrequency,
  type RequiredDocument,
} from '@/engine';
import type { FileStore } from '@/db/files';
import { addDocument, deleteDocument, listDocuments, setDocumentChecked, updateDocument } from '@/db/repos/verify';
import type { DocumentType } from '@/db/schema';
import type { AppDb, DocumentRow, Income } from '@/db/types';
import type { AppFiles } from '@/files/files';

import { localIso } from '../time';
import type { PickResult } from './picker';

export type AttachmentFiles = Pick<AppFiles, 'saveAttachment' | 'deleteFile'>;

export type SlotState = 'missing' | 'provided' | 'checked';

export interface DocumentSlot {
  /** 'photo_id', 'proof_of_income', 'other:pet records'… */
  key: string;
  type: DocType;
  label: string;
  /** Free text of an "Other" required document. */
  otherLabel: string | null;
  required: boolean;
  state: SlotState;
  files: DocumentRow[];
}

const sameOther = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** DB row → engine DocumentInput (checked date only). Paper-form photos are not C6 documents. */
export function toDocumentInput(d: DocumentRow): DocumentInput | null {
  if (d.type === 'paper_form') return null;
  return {
    id: String(d.id),
    type: d.type,
    label: d.label,
    checkedOn: d.checkedAt ? d.checkedAt.slice(0, 10) : null,
    incomeId: d.incomeId != null ? String(d.incomeId) : null,
    payGrossCents: d.payGrossCents,
    payFrequency: d.payFrequency,
    monthlyCents: d.monthlyCents,
  };
}

const inputs = (rows: readonly DocumentRow[]) => rows.map(toDocumentInput).filter((x): x is DocumentInput => x !== null);

/**
 * S-10 list: one slot per required document (C6 order), then "Other files" — documents of types not required,
 * grouped by type (Other by label). Paper-form photos are left out (they show in the application).
 */
export function documentSlots(required: readonly RequiredDocument[], rows: readonly DocumentRow[]): { slots: DocumentSlot[]; otherFiles: DocumentRow[] } {
  const docs = rows.filter((d) => d.type !== 'paper_form');
  const used = new Set<number>();
  const slots = required.map((req): DocumentSlot => {
    const files = docs.filter((d) => d.type === req.type && (req.type !== 'other' || sameOther(d.label, req.label)));
    files.forEach((f) => used.add(f.id));
    const p = documentProgress([req], inputs(files));
    return {
      key: req.type === 'other' ? `other:${(req.label ?? '').trim().toLowerCase()}` : req.type,
      type: req.type,
      label: requiredDocLabel(req),
      otherLabel: req.type === 'other' ? (req.label ?? null) : null,
      required: true,
      state: p.provided === 0 ? 'missing' : p.checked === 1 ? 'checked' : 'provided',
      files,
    };
  });
  return { slots, otherFiles: docs.filter((d) => !used.has(d.id)) };
}

/** S-09 "Documents 2/3" + whether every required file is checked (C6 Verified). */
export function documentCounts(required: readonly RequiredDocument[], rows: readonly DocumentRow[]) {
  return documentProgress(required, inputs(rows));
}

export function paperFormPhotos(rows: readonly DocumentRow[]): DocumentRow[] {
  return rows.filter((d) => d.type === 'paper_form');
}

export interface AddDocumentInput {
  applicantId: number;
  type: DocumentType;
  /** Required for type 'other' (the slot's label, or what the landlord typed). */
  label?: string | null;
  /** Proof of income: the income line it proves (null = the only one). */
  incomeId?: number | null;
  picked: Extract<PickResult, { status: 'picked' }>;
}

/** Saves the picked file into the applicant's folder, then the row. A failed insert removes the file again. */
export async function addPickedDocument(db: AppDb, files: AttachmentFiles, input: AddDocumentInput, now = new Date()): Promise<number> {
  const saved = await files.saveAttachment({
    owner: { applicantId: input.applicantId },
    kind: input.type === 'paper_form' ? 'paper' : 'doc',
    sourceUri: input.picked.uri,
    mime: input.picked.mime,
    name: input.picked.name,
  });
  try {
    return addDocument(db, {
      applicantId: input.applicantId,
      type: input.type,
      label: input.type === 'other' ? (input.label?.trim() || DOC_TYPE_LABELS.other) : null,
      filePath: saved.path,
      mime: saved.mime,
      addedAt: localIso(now),
      incomeId: input.type === 'proof_of_income' ? (input.incomeId ?? null) : null,
    });
  } catch (e) {
    files.deleteFile(saved.path);
    throw e;
  }
}

/** "Mark as checked" (records the time, "by you") / undo. */
export function markChecked(db: AppDb, documentId: number, checked: boolean, now = new Date()): void {
  setDocumentChecked(db, documentId, checked ? localIso(now) : null);
}

export function removeDocument(db: AppDb, files: FileStore, documentId: number): void {
  deleteDocument(db, files, documentId);
}

/** Pay-stub details or a letter's monthly amount (the other pair is cleared), and the income line it proves. */
export type IncomeDetails =
  | { kind: 'pay_stub'; payGrossCents: number | null; payFrequency: PayFrequency | null; incomeId?: number | null }
  | { kind: 'monthly'; monthlyCents: number | null; incomeId?: number | null };

export function setIncomeDetails(db: AppDb, documentId: number, d: IncomeDetails): void {
  const link = d.incomeId !== undefined ? { incomeId: d.incomeId } : {};
  updateDocument(
    db,
    documentId,
    d.kind === 'pay_stub'
      ? { payGrossCents: d.payGrossCents, payFrequency: d.payFrequency, monthlyCents: null, ...link }
      : { monthlyCents: d.monthlyCents, payGrossCents: null, payFrequency: null, ...link },
  );
}

export type IncomeCheckState =
  | { status: 'ok'; check: IncomeCheck; income: Income }
  /** No gross / frequency (or monthly amount) typed yet. */
  | { status: 'no_amount' }
  /** Several income lines and the document is not linked to one: ask which it proves. */
  | { status: 'choose_income'; options: Income[] }
  /** The linked line (or the only one) has no stated amount. */
  | { status: 'no_stated' };

/** S-10 "Income check" for one proof-of-income document. */
export function incomeCheckFor(doc: DocumentRow, incomes: readonly Income[]): IncomeCheckState {
  const input = toDocumentInput(doc);
  const docMonthly = input ? documentMonthlyCents(input) : null;
  if (docMonthly == null) return { status: 'no_amount' };
  const stated = incomes.filter((i) => i.monthlyCents != null);
  const income = doc.incomeId != null ? incomes.find((i) => i.id === doc.incomeId) : stated.length === 1 ? stated[0] : undefined;
  if (!income) return stated.length > 1 ? { status: 'choose_income', options: stated } : { status: 'no_stated' };
  if (income.monthlyCents == null) return { status: 'no_stated' };
  return { status: 'ok', check: incomeCheck(docMonthly, income.monthlyCents), income };
}

/** Pay frequency choices in S-10 order (labels: `intake:payFrequency.<value>`). */
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

export function listApplicantDocuments(db: AppDb, applicantId: number): DocumentRow[] {
  return listDocuments(db, applicantId);
}
