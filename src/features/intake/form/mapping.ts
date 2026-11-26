/**
 * Application form ↔ database rows (applicants + residences + incomes). '' ↔ null, pets counts ↔ Pet[],
 * other adults ↔ `other_adults` names + one `incomes` row (kind other_adult) each.
 */
import type { PetKind } from '@/engine';
import type { Applicant, Income, NewApplicant, NewIncome, NewResidence, Pet, Residence } from '@/db';

import { emptyForm, OTHER_INCOME_KINDS, type ApplicationForm, type OtherIncomeKind } from './model';

const txt = (s: string | null | undefined) => {
  const v = (s ?? '').trim();
  return v === '' ? null : v;
};
const str = (s: string | null | undefined) => s ?? '';

const PET_KINDS: readonly PetKind[] = ['cat', 'dog', 'other'];

export function formFromRows(a: Applicant, residences: readonly Residence[], incomes: readonly Income[]): ApplicationForm {
  const f = emptyForm(a.receivedAt);
  const pets = { cat: 0, dog: 0, other: 0 };
  for (const p of a.pets ?? []) if (p.kind in pets) pets[p.kind] += p.count;
  const job = incomes.find((i) => i.kind === 'employment');
  const adultIncomes = incomes.filter((i) => i.kind === 'other_adult');
  const used = new Set<number>();
  const otherAdults = (a.otherAdults ?? []).map((o, idx) => {
    // Match an adult's income by name first, then by position.
    const inc =
      adultIncomes.find((i) => !used.has(i.id) && (i.person ?? '') === o.name) ??
      adultIncomes.filter((i) => !used.has(i.id))[0];
    if (inc) used.add(inc.id);
    return { key: inc ? `i${inc.id}` : `a${idx}`, incomeId: inc?.id, name: o.name, monthlyCents: inc?.monthlyCents ?? null };
  });
  return {
    ...f,
    fullName: str(a.fullName),
    phone: str(a.phone),
    email: str(a.email),
    emergencyName: str(a.emergency?.name),
    emergencyPhone: str(a.emergency?.phone),
    occupants: a.occupants ?? f.occupants,
    otherAdults,
    pets,
    petsAnswered: a.pets != null,
    moveInOn: a.moveInOn,
    hasVoucher: a.hasVoucher,
    voucherCents: a.voucherCents,
    voucherProgram: str(a.voucherProgram),
    residences: residences.map((r) => ({
      key: `r${r.id}`,
      id: r.id,
      address: r.address,
      fromMonth: r.fromMonth,
      toMonth: r.toMonth,
      current: r.current,
      type: r.type,
      rentCents: r.rentCents,
      landlordName: str(r.landlordName),
      landlordPhone: str(r.landlordPhone),
      landlordEmail: str(r.landlordEmail),
      reason: str(r.reason),
    })),
    jobIncomeId: job?.id,
    employer: str(job?.employer),
    jobTitle: str(job?.title),
    startMonth: job?.startOn ?? null,
    monthlyCents: job?.monthlyCents ?? null,
    employerPhone: str(job?.phone),
    supervisor: str(job?.supervisor),
    otherIncome: incomes
      .filter((i) => (OTHER_INCOME_KINDS as readonly string[]).includes(i.kind))
      .map((i) => ({ key: `i${i.id}`, id: i.id, kind: i.kind as OtherIncomeKind, monthlyCents: i.monthlyCents })),
    answers: {
      evicted: a.answers?.evicted ?? null,
      bankruptcy: a.answers?.bankruptcy ?? null,
      smokes: a.answers?.smokes ?? null,
    },
    explain: {
      evicted: str(a.answers?.explain?.evicted),
      bankruptcy: str(a.answers?.explain?.bankruptcy),
      smokes: str(a.answers?.explain?.smokes),
    },
    customAnswers: { ...(a.customAnswers ?? {}) },
    consent: { authorize: a.consent?.authorize ?? false, certify: a.consent?.certify ?? false },
    pendingSignature: null,
    signaturePath: a.signaturePath,
    signedAt: a.signedAt,
    signedName: str(a.signedName),
  };
}

/** Applicant columns of the form (never receivedAt / status / draft / source — the service sets those). */
export function applicantPatch(f: ApplicationForm): Omit<NewApplicant, 'rentalId' | 'receivedAt'> {
  const pets: Pet[] = PET_KINDS.filter((k) => f.pets[k] > 0).map((k) => ({ kind: k, count: f.pets[k] }));
  const explain = Object.fromEntries(
    (['evicted', 'bankruptcy', 'smokes'] as const).filter((k) => f.answers[k] === 'yes' && txt(f.explain[k])).map((k) => [k, txt(f.explain[k])!]),
  );
  return {
    fullName: f.fullName.trim(),
    phone: txt(f.phone),
    email: txt(f.email),
    emergency: txt(f.emergencyName) || txt(f.emergencyPhone) ? { name: txt(f.emergencyName) ?? undefined, phone: txt(f.emergencyPhone) ?? undefined } : null,
    occupants: f.occupants,
    otherAdults: f.otherAdults.map((a) => ({ name: a.name.trim() })),
    pets: f.petsAnswered ? pets : null,
    moveInOn: f.moveInOn,
    hasVoucher: f.hasVoucher,
    voucherCents: f.hasVoucher ? f.voucherCents : null,
    voucherProgram: f.hasVoucher ? txt(f.voucherProgram) : null,
    answers: { ...f.answers, ...(Object.keys(explain).length ? { explain } : {}) },
    customAnswers: { ...f.customAnswers },
    consent: { ...f.consent },
    signedName: txt(f.signedName),
  };
}

export function residenceRows(f: ApplicationForm): (Omit<NewResidence, 'applicantId'> & { id?: number })[] {
  return f.residences.map((r) => ({
    id: r.id,
    address: r.address.trim(),
    fromMonth: r.fromMonth,
    toMonth: r.current ? null : r.toMonth,
    current: r.current,
    type: r.type,
    rentCents: r.rentCents,
    landlordName: txt(r.landlordName),
    landlordPhone: txt(r.landlordPhone),
    landlordEmail: txt(r.landlordEmail),
    reason: txt(r.reason),
  }));
}

/** True when the job part has anything in it (otherwise no employment row is written). */
const hasJob = (f: ApplicationForm) =>
  !!(txt(f.employer) || txt(f.jobTitle) || f.startMonth || f.monthlyCents != null || txt(f.employerPhone) || txt(f.supervisor));

export function incomeRows(f: ApplicationForm): (Omit<NewIncome, 'applicantId'> & { id?: number })[] {
  const rows: (Omit<NewIncome, 'applicantId'> & { id?: number })[] = [];
  if (hasJob(f))
    rows.push({
      id: f.jobIncomeId,
      kind: 'employment',
      employer: txt(f.employer),
      title: txt(f.jobTitle),
      startOn: f.startMonth,
      monthlyCents: f.monthlyCents,
      phone: txt(f.employerPhone),
      supervisor: txt(f.supervisor),
    });
  for (const o of f.otherIncome) rows.push({ id: o.id, kind: o.kind, monthlyCents: o.monthlyCents });
  for (const a of f.otherAdults) rows.push({ id: a.incomeId, kind: 'other_adult', person: a.name.trim() || null, monthlyCents: a.monthlyCents });
  return rows;
}

/** After saving, give new rows their DB ids so the next autosave updates instead of inserting again. */
export function withSavedIds(f: ApplicationForm, residenceIds: readonly number[], incomeIds: readonly number[]): ApplicationForm {
  let k = 0;
  const job = hasJob(f) ? incomeIds[k++] : undefined;
  const otherIncome = f.otherIncome.map((o) => ({ ...o, id: incomeIds[k++] }));
  const otherAdults = f.otherAdults.map((a) => ({ ...a, incomeId: incomeIds[k++] }));
  return {
    ...f,
    jobIncomeId: job,
    otherIncome,
    otherAdults,
    residences: f.residences.map((r, i) => ({ ...r, id: residenceIds[i] })),
  };
}

