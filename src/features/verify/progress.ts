/**
 * Verification progress for an Applicant — the rows S-09 (2D) shows under "Sections" ("References 1/2",
 * "Screening report —", "Background (after offer)") and links to S-11 … S-14. Counts, not scores.
 */
import type { ApplicantBundle } from '@/db/repos/applicants';
import { conditionalOfferAt } from '@/db/toEngine';

import { hasReportResults } from './report';

export type ReferenceStatus = 'not_started' | 'in_progress' | 'answered' | 'unreachable';

export interface LandlordRefRow {
  residenceId: number;
  referenceId: number | null;
  address: string;
  current: boolean;
  status: ReferenceStatus;
  attempts: number;
}

export interface EmployerRefRow {
  incomeId: number;
  referenceId: number | null;
  employer: string;
  status: ReferenceStatus;
  attempts: number;
}

export interface VerifyProgress {
  landlord: LandlordRefRow[];
  employer: EmployerRefRow[];
  /** "References {done}/{total}" — landlord references of rented residences (the ones C2 / C4 / C5 use). */
  references: { done: number; total: number };
  report: 'none' | 'entered';
  background: 'locked' | 'open' | 'done';
}

type Ref = ApplicantBundle['references'][number];

function statusOf(ref: Ref | undefined, answered: (r: Ref) => boolean): ReferenceStatus {
  if (!ref) return 'not_started';
  if (ref.unreachable) return 'unreachable';
  if (answered(ref)) return 'answered';
  return ref.attempts.length > 0 || ref.ownerConfirmed || ref.answers ? 'in_progress' : 'not_started';
}

export function verifyProgress(b: ApplicantBundle): VerifyProgress {
  const refs = b.references;
  const landlord = b.residences
    .filter((r) => r.type === 'rent')
    .map((r) => {
      const ref = refs.find((x) => x.kind === 'landlord' && x.residenceId === r.id);
      return {
        residenceId: r.id,
        referenceId: ref?.id ?? null,
        address: r.address,
        current: r.current,
        status: statusOf(ref, (x) => x.answers?.rentAgain != null),
        attempts: ref?.attempts.length ?? 0,
      };
    });
  const employer = b.incomes
    .filter((i) => i.kind === 'employment')
    .map((i) => {
      const ref = refs.find((x) => x.kind === 'employer' && x.incomeId === i.id);
      return {
        incomeId: i.id,
        referenceId: ref?.id ?? null,
        employer: i.employer ?? '',
        status: statusOf(ref, (x) => x.answers?.employed != null),
        attempts: ref?.attempts.length ?? 0,
      };
    });
  const offer = conditionalOfferAt(b.decisions);
  const bg = b.background;
  return {
    landlord,
    employer,
    references: { done: landlord.filter((r) => r.status === 'answered' || r.status === 'unreachable').length, total: landlord.length },
    report: hasReportResults(b.report) ? 'entered' : 'none',
    background: !offer ? 'locked' : bg && (bg.noConvictions || (bg.convictions ?? []).length > 0) ? 'done' : 'open',
  };
}
