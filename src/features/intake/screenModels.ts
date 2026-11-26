/**
 * What the intake screens show, as pure functions (tested without rendering): labels, summaries, button states,
 * month / time inputs. Screens stay thin: they call these and the services.
 */
import { formatMonth, formatUsd, type DocType } from '@/engine';
import { t } from '@/i18n';

import type { SlotState } from './documents/service';
import { SECTION_COUNT, type ApplicationForm, type FormMode, type FormSection, type OtherIncomeKind, type ResidenceDraft } from './form/model';
import type { SaveState } from './form/controller';
import type { FieldError } from './form/validate';
import { isYearMonth } from './time';

/** Untyped lookup for keys built at run time (`intake:errors.${code}`); every key exists in intake.json (tested). */
export const tx = (key: string, opts?: Record<string, unknown>): string => (t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, opts);

export const errorText = (errors: readonly FieldError[], field: string): string | null => {
  const e = errors.find((x) => x.field === field);
  return e ? tx(`intake:errors.${e.code}`) : null;
};

// ---------------------------------------------------------------- Form header / footer

export function formHeader(o: { isNew: boolean; save: SaveState }): { title: string; subtitle: string | undefined } {
  const subtitle =
    o.save === 'pending' ? t('intake:s08.saving') : o.save === 'saved' ? t('intake:s08.draftSaved') : o.save === 'error' ? t('intake:s08.saveFailed') : undefined;
  return { title: o.isNew ? t('intake:s08.newTitle') : t('intake:s08.title'), subtitle: o.isNew ? subtitle : o.save === 'error' ? subtitle : undefined };
}

export interface FooterModel {
  primaryLabel: string;
  /** "Back" shown (hidden on part 1 in applicant mode: nothing before it). */
  showBack: boolean;
  isLast: boolean;
}

export function formFooter(step: FormSection, mode: FormMode): FooterModel {
  const isLast = step === SECTION_COUNT;
  return {
    primaryLabel: isLast ? (mode === 'applicant' ? t('intake:s08.submit') : t('intake:s08.save')) : t('common:actions.next'),
    showBack: !(mode === 'applicant' && step === 1),
    isLast,
  };
}

// ---------------------------------------------------------------- Month / time inputs

/** 'YYYY-MM' → "10 / 2024" (the residence editor's text). */
export function formatMonthInput(ym: string | null): string {
  return isYearMonth(ym) ? `${ym.slice(5, 7)} / ${ym.slice(0, 4)}` : '';
}

/** "10/2024", "10 / 2024", "102024", "1/2024" → '2024-10'; null when incomplete / invalid. */
export function parseMonthInput(text: string): string | null {
  const m = /^\s*(\d{1,2})\s*[/\-.\s]?\s*(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const mm = Number(m[1]);
  const yy = Number(m[2]);
  if (mm < 1 || mm > 12 || yy < 1900 || yy > 2100) return null;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

/** Wall-clock parts of a stored timestamp (no time-zone shift): "Dec 2, 2026" + "9:14 AM". */
export function receivedParts(ts: string): { date: string; time: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(ts);
  if (!m) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = Number(m[4]);
  return {
    date: `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`,
    time: `${h % 12 === 0 ? 12 : h % 12}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`,
  };
}

/** "Dec 2, 2026 · 9:14 AM" (S-08 part 7 "Received on"). */
export function receivedLine(ts: string): string {
  const p = receivedParts(ts);
  return p ? `${p.date} · ${p.time}` : ts;
}

/** "9:14 AM" / "9:14am" / "21:05" → { h, m } (24 h); null when invalid. */
export function parseTimeInput(text: string): { h: number; m: number } | null {
  const x = /^\s*(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?\s*$/i.exec(text);
  if (!x) return null;
  let h = Number(x[1]);
  const m = Number(x[2]);
  if (m > 59) return null;
  if (x[3]) {
    if (h < 1 || h > 12) return null;
    const pm = x[3].toLowerCase() === 'p';
    h = (h % 12) + (pm ? 12 : 0);
  } else if (h > 23) return null;
  return { h, m };
}

/** Replace the date and/or time of a stored timestamp, keeping its UTC offset ('…-05:00'). */
export function withDateTime(ts: string, date: string | null, time: { h: number; m: number } | null): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(:\d{2})?(.*)$/.exec(ts);
  if (!m) return ts;
  const d = date ?? m[1];
  const hh = time ? String(time.h).padStart(2, '0') : m[2];
  const mm = time ? String(time.m).padStart(2, '0') : m[3];
  return `${d}T${hh}:${mm}:00${m[5]}`;
}

// ---------------------------------------------------------------- Lists

/** "Oct 2024 – now · $1,450/mo · Oakline Property Mgmt" (residence card, S-08 part 3 + review). */
export function residenceSummary(r: ResidenceDraft): string {
  const from = isYearMonth(r.fromMonth) ? formatMonth(r.fromMonth) : '?';
  const to = r.current ? t('intake:fields.now') : isYearMonth(r.toMonth) ? formatMonth(r.toMonth) : '?';
  return [`${from} – ${to}`, r.rentCents != null ? `${formatUsd(r.rentCents)}/mo` : null, r.landlordName.trim() || null].filter(Boolean).join(' · ');
}

export const residenceTypeLabel = (r: ResidenceDraft) => (r.type ? tx(`intake:residenceType.${r.type}`) : '');

/** Pets pill: "Dog · 1" when selected, "Dog" otherwise. */
export function petPillLabel(kind: 'cat' | 'dog' | 'other', count: number): string {
  const name = tx(`intake:petKind.${kind}`);
  return count > 0 ? `${name} · ${count}` : name;
}

export const incomeKindLabel = (k: OtherIncomeKind | 'employment' | 'other_adult') => tx(`intake:incomeKind.${k}`);

export interface ReviewRow {
  label: string;
  value: string;
}
export interface ReviewSection {
  step: FormSection;
  title: string;
  rows: ReviewRow[];
}

const yn = (v: 'yes' | 'no' | boolean | null) => (v == null ? '—' : v === true || v === 'yes' ? t('intake:yesNo.yes') : t('intake:yesNo.no'));

/** S-08 part 7: one card per part with the answers given (empty answers left out, "—" for a missing Yes/No). */
export function reviewSections(f: ApplicationForm, customQuestions: readonly { id: string; title: string }[] = []): ReviewSection[] {
  const rows = (...r: (ReviewRow | null | false)[]) => r.filter((x): x is ReviewRow => !!x);
  const row = (label: string, value: string | null | undefined): ReviewRow | null => (value && value.trim() ? { label, value } : null);
  const money = (c: number | null) => (c != null ? formatUsd(c) : null);
  const pets = (['cat', 'dog', 'other'] as const).filter((k) => f.pets[k] > 0).map((k) => petPillLabel(k, f.pets[k]));
  return [
    {
      step: 1,
      title: t('intake:sections.about'),
      rows: rows(
        row(t('intake:fields.fullName'), f.fullName),
        row(t('intake:fields.phone'), f.phone),
        row(t('intake:fields.email'), f.email),
        row(t('intake:fields.emergency'), [f.emergencyName, f.emergencyPhone].filter((x) => x.trim()).join(' · ')),
      ),
    },
    {
      step: 2,
      title: t('intake:sections.household'),
      rows: rows(
        row(t('intake:fields.occupants'), f.occupants != null ? String(f.occupants) : null),
        row(t('intake:fields.otherAdults'), f.otherAdults.map((a) => a.name).filter(Boolean).join(', ')),
        row(t('intake:fields.pets'), pets.join(', ') || (f.petsAnswered ? t('intake:yesNo.no') : null)),
        row(t('intake:fields.moveInOn'), f.moveInOn ? formatMonthDay(f.moveInOn) : null),
        { label: t('intake:fields.voucher'), value: yn(f.hasVoucher) },
        f.hasVoucher === true && row(t('intake:fields.voucherAmount'), money(f.voucherCents)),
        f.hasVoucher === true && row(t('intake:fields.voucherProgram'), f.voucherProgram),
      ),
    },
    {
      step: 3,
      title: t('intake:sections.residences'),
      rows: f.residences.map((r) => ({ label: r.address || '—', value: [residenceTypeLabel(r), residenceSummary(r)].filter(Boolean).join(' · ') })),
    },
    {
      step: 4,
      title: t('intake:sections.work'),
      rows: rows(
        row(t('intake:fields.employer'), [f.employer, f.jobTitle].filter((x) => x.trim()).join(' · ')),
        row(t('intake:fields.grossMonthly'), money(f.monthlyCents)),
        ...f.otherIncome.map((o) => row(incomeKindLabel(o.kind), money(o.monthlyCents))),
        ...f.otherAdults.map((a) => row(a.name || t('intake:incomeKind.other_adult'), money(a.monthlyCents))),
      ),
    },
    {
      step: 5,
      title: t('intake:sections.questions'),
      rows: [
        ...(['evicted', 'bankruptcy', 'smokes'] as const).map((k) => ({
          label: tx(`intake:questions.${k}`),
          value: f.answers[k] === 'yes' && f.explain[k].trim() ? `${yn('yes')} · ${f.explain[k].trim()}` : yn(f.answers[k]),
        })),
        ...customQuestions.map((q) => ({ label: q.title, value: yn(f.customAnswers[q.id] ?? null) })),
      ],
    },
    {
      step: 6,
      title: t('intake:sections.consent'),
      rows: rows(
        row(t('intake:fields.printedName'), f.signedName),
        { label: t('intake:fields.signature'), value: f.signaturePath || f.pendingSignature ? t('ui:signature.signed') : t('ui:signature.empty') },
      ),
    },
  ];
}

/** 'YYYY-MM-DD' → "Jan 1, 2027". */
export function formatMonthDay(d: string): string {
  return receivedParts(`${d}T00:00`)?.date ?? d;
}

// ---------------------------------------------------------------- Documents

export interface SlotChip {
  kind: 'missing' | 'chip';
  label: string;
  tone: 'accent' | 'neutral';
}

export function slotChip(state: SlotState): SlotChip {
  if (state === 'missing') return { kind: 'missing', label: t('intake:s10.missing'), tone: 'neutral' };
  return state === 'checked' ? { kind: 'chip', label: t('intake:s10.checked'), tone: 'accent' } : { kind: 'chip', label: t('intake:s10.provided'), tone: 'neutral' };
}

/** Hint under a missing slot (proof of income only, mockup). */
export const slotHint = (type: DocType, state: SlotState) => (type === 'proof_of_income' && state === 'missing' ? t('intake:s10.proofHint') : null);

/** "Checked Dec 5, 2026 · by you" from the latest checked time of the slot's files. */
export function checkedLine(checkedAts: readonly (string | null)[]): string | null {
  const all = checkedAts.filter((x): x is string => !!x).sort();
  if (!all.length || all.length !== checkedAts.length) return null;
  const p = receivedParts(all[all.length - 1]);
  return p ? t('intake:s10.checkedBy', { date: p.date }) : null;
}

/** Spoken label of a thumbnail: "Proof of income, file 2 of 3, checked". */
export function thumbLabel(slotLabel: string, index: number, total: number, checked: boolean): string {
  return [slotLabel, `${index + 1} / ${total}`, checked ? t('intake:s10.checked') : null].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- Applicant mode

/** S-08b lines. */
export function doneText(firstName: string, receivedAt: string | null): { thanks: string; received: string | null } {
  const p = receivedAt ? receivedParts(receivedAt) : null;
  return {
    thanks: firstName ? t('intake:s08b.thanks', { name: firstName }) : t('intake:s08b.title'),
    received: p ? t('intake:s08b.receivedOn', { date: p.date, time: p.time }) : null,
  };
}
