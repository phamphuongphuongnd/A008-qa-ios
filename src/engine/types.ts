/**
 * Evenlease engine types (product.md §3, terms from CONTEXT.md).
 *
 * These are ENGINE INPUT/OUTPUT types, separate from the SQLite row types: the DB layer (1C) maps rows to them.
 * Units:
 * - money: integer US cents (`Cents`), never floats of dollars;
 * - dates: `IsoDate` 'YYYY-MM-DD' (local calendar date), months `YearMonth` 'YYYY-MM';
 * - timestamps: `IsoDateTime` ISO 8601 with the device's offset (e.g. '2026-12-02T09:14:00-05:00') or 'Z'.
 * There is NO total score and NO ranking anywhere in this API.
 */

/** Integer number of US cents. */
export type Cents = number;
/** Calendar date 'YYYY-MM-DD'. */
export type IsoDate = string;
/** Calendar month 'YYYY-MM'. */
export type YearMonth = string;
/** ISO 8601 timestamp with offset ('2026-12-02T09:14:00-05:00') or UTC ('…Z'). */
export type IsoDateTime = string;

export type YesNo = 'yes' | 'no';

// ---------------------------------------------------------------------------
// Rental + Criteria (§3.2)
// ---------------------------------------------------------------------------

export type ReviewMode = 'compare' | 'first_come';

/** The parts of a Rental the rules need. */
export interface RentalInput {
  id: string;
  rentCents: Cents;
  /** 0 = Studio (counts as 1 for C7). */
  bedrooms: number;
  reviewMode: ReviewMode;
  /** Two-letter state, used only for hints (WA → first-come). */
  state?: string | null;
}

export type CriterionCode = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10' | 'CX';

/** Document categories (C6 list + "Other"). Proof of income = pay stubs, offer letter, or benefits / voucher letter. */
export type DocType =
  | 'photo_id'
  | 'proof_of_income'
  | 'bank_statement'
  | 'reference_letter'
  | 'voucher_letter'
  | 'other';

export interface RequiredDocument {
  type: DocType;
  /** Free-text label, only for type 'other'. */
  label?: string | null;
}

export type PetPolicy = 'no_pets' | 'cats_only' | 'cats_and_dogs' | 'case_by_case';

interface CriterionBase {
  /** Stable id (DB row id). Custom answers are keyed by it. */
  id: string;
  enabled: boolean;
  /** Display order (ascending). */
  order: number;
}

export interface C1Params {
  /** Income multiple in tenths: 30 = 3.0×. Range 20–40. */
  multipleTenths: number;
  /** "Apply to tenant's share when a housing voucher pays part of the rent" (default ON). */
  applyToTenantShare: boolean;
}

export type Criterion =
  | (CriterionBase & { code: 'C1'; params: C1Params })
  | (CriterionBase & { code: 'C2'; params: { months: number } })
  | (CriterionBase & { code: 'C3'; params: { years: number } })
  | (CriterionBase & { code: 'C4'; params: Record<string, never> })
  | (CriterionBase & { code: 'C5'; params: Record<string, never> })
  | (CriterionBase & { code: 'C6'; params: { documents: RequiredDocument[] } })
  | (CriterionBase & { code: 'C7'; params: { perBedroom: number } })
  | (CriterionBase & { code: 'C8'; params: { policy: PetPolicy; maxPets: number } })
  | (CriterionBase & { code: 'C9'; params: { minScore: number } })
  | (CriterionBase & { code: 'C10'; params: { lookbackYears: number } })
  | (CriterionBase & { code: 'CX'; params: { title: string; answeredBy: 'applicant' | 'landlord' } });

export type CriterionOf<C extends CriterionCode> = Extract<Criterion, { code: C }>;

// ---------------------------------------------------------------------------
// Applicant inputs (§5 S-08, S-10 – S-14)
// ---------------------------------------------------------------------------

export type ApplicantStatus =
  | 'new'
  | 'in_review'
  | 'conditional_offer'
  | 'approved'
  | 'denied'
  | 'withdrawn'
  | 'incomplete'
  /** First-come: the 48 h offer ran out ("Offer expired — move to next"). */
  | 'offer_expired';

export type ResidenceType = 'rent' | 'own' | 'with_family' | 'other';

export interface Residence {
  id: string;
  address: string;
  from: YearMonth;
  /** null when `current`. */
  to: YearMonth | null;
  current: boolean;
  type: ResidenceType;
  rentCents: Cents | null;
}

export type IncomeKind =
  | 'employment'
  | 'self_employment'
  | 'benefits'
  | 'child_support'
  | 'retirement'
  | 'other'
  /** "Income of other adults" (one entry per adult). */
  | 'other_adult';

export interface IncomeSource {
  id: string;
  kind: IncomeKind;
  /** Stated gross monthly amount; null = left blank. */
  monthlyCents: Cents | null;
  /** Other adult's name, employer… (display only). */
  label?: string | null;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface DocumentInput {
  id: string;
  type: DocType;
  label?: string | null;
  /** Date the landlord ticked "Mark as checked"; null = provided only. */
  checkedOn: IsoDate | null;
  /** Income check (proof of income): the income source this document proves. null = the only source, if there is one. */
  incomeId?: string | null;
  /** Pay stub: gross per period + frequency. */
  payGrossCents?: Cents | null;
  payFrequency?: PayFrequency | null;
  /** Offer letter / benefits letter: "Monthly amount on this document". */
  monthlyCents?: Cents | null;
}

export type AttemptMethod = 'call' | 'email' | 'text';
export type AttemptResult = 'reached' | 'no_answer' | 'left_message' | 'wrong_number';

export interface Attempt {
  at: IsoDateTime;
  method: AttemptMethod;
  result: AttemptResult;
}

export type ConfirmSource = 'county_records' | 'management_website' | 'lease_shown' | 'other';
export type Answer3 = 'yes' | 'no' | 'wouldnt_say';

/** Landlord reference call sheet (S-11). Unanswered questions are null. */
export interface LandlordReference {
  id: string;
  residenceId: string;
  /** "I confirmed this person owns or manages the property". */
  ownerConfirmed: boolean;
  confirmSource: ConfirmSource | null;
  /** Date of the call / answer (evidence date). */
  answeredOn: IsoDate | null;
  /** Q1 "Did {name} rent from you at {address}?" */
  rentedFromYou: Answer3 | null;
  /** Q2 from / to (month) or 'still_there'. */
  from: YearMonth | null;
  to: YearMonth | 'still_there' | null;
  /** Q3 monthly rent. */
  rentCents: Cents | null;
  /** Q8 "Do they owe unpaid rent or damages?" */
  owes: Answer3 | null;
  owesCents: Cents | null;
  /** Q9 "Would you rent to them again?" */
  rentAgain: Answer3 | null;
  unreachable: boolean;
  attempts: Attempt[];
}

/** Employer reference (S-12). Not used by C1–C10 (income is verified with documents). */
export interface EmployerReference {
  id: string;
  incomeId: string | null;
  employed: 'yes' | 'no' | 'wont_confirm' | null;
  since: YearMonth | null;
  title: string | null;
  attempts: Attempt[];
}

export type EvictionOutcome = 'judgment' | 'settled' | 'dismissed' | 'tenant_won' | 'unknown';

export interface EvictionCase {
  /** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' — reports often show only the year. */
  date: string;
  outcome: EvictionOutcome;
}

/** Key results of an outside Screening report (S-13). */
export interface ScreeningReport {
  id: string;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  reportDate: IsoDate | null;
  /** [] = "None found"; null = not entered. */
  evictions: EvictionCase[] | null;
  /** 0 = None; null = not entered. */
  landlordCollectionsCents: Cents | null;
  /** Credit score (C9). */
  score: number | null;
  noScore: boolean;
  scoreModel: string | null;
  scoreRange: string | null;
  scoreDate: IsoDate | null;
  keyFactors: string[];
}

export type ConvictionType = 'violent' | 'property' | 'drug' | 'fraud' | 'other';

export interface Conviction {
  type: ConvictionType;
  convictedOn: IsoDate;
  sentenceEndedOn: IsoDate | null;
}

/** Background review, step 2 after a Conditional offer (S-14). */
export interface BackgroundReview {
  /** "No convictions in the past {N} years". */
  noConvictions: boolean;
  convictions: Conviction[];
  reviewedOn: IsoDate | null;
  /** The individual assessment (required when there are convictions). "How long ago" is computed. */
  assessment: {
    seriousness: string | null;
    rehabilitation: string | null;
    other: string | null;
  };
}

export type PetKind = 'cat' | 'dog' | 'other';

export interface PetEntry {
  kind: PetKind;
  count: number;
}

export interface ApplicantInput {
  id: string;
  fullName: string;
  /** Locked timestamp (§3.14). Its date part is the "date received". */
  receivedAt: IsoDateTime;
  status: ApplicantStatus;
  /** When the Conditional offer was made; null = not yet (C10 not open). */
  conditionalOfferAt: IsoDateTime | null;
  /** Total people who will live there (all ages). */
  occupants: number | null;
  /** [] = no pets; null = not answered. */
  pets: PetEntry[] | null;
  /** "Will a housing voucher … pay part of the rent?" null = not answered. */
  hasVoucher: boolean | null;
  voucherMonthlyCents: Cents | null;
  residences: Residence[];
  incomes: IncomeSource[];
  documents: DocumentInput[];
  landlordReferences: LandlordReference[];
  employerReferences: EmployerReference[];
  report: ScreeningReport | null;
  background: BackgroundReview | null;
  answers: {
    /** "Have you been evicted or had an eviction case filed against you in the past 7 years?" */
    evicted: YesNo | null;
    bankruptcy: YesNo | null;
    smokes: YesNo | null;
  };
  /** Custom yes/no criteria answered by the applicant, keyed by criterion id. */
  customAnswers: Record<string, boolean | null>;
  /** Custom yes/no criteria checked by the landlord, keyed by criterion id. */
  landlordChecks: Record<string, boolean | null>;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** 'not_reviewed' only for C10 before a Conditional offer ("Not reviewed yet (after offer)"). */
export type Outcome = 'met' | 'not_met' | 'missing' | 'needs_review' | 'not_reviewed';
export type Evidence = 'claimed' | 'verified' | 'mismatch';
export type EvidenceSource =
  | 'application'
  | 'document'
  | 'landlord_reference'
  | 'employer_reference'
  | 'screening_report'
  | 'landlord_note';

/** Issues hold only Mismatch / Needs review / Missing; Not met is never an issue (Phương chốt 2026-11-25). */
export type IssueKind = 'mismatch' | 'needs_review' | 'missing';

/** Where the UI sends the landlord to fix an issue (S-09 buttons). */
export type IssueAction =
  | 'edit_application'
  | 'add_documents'
  | 'review_documents'
  | 'call_landlord'
  | 'confirm_landlord'
  | 'add_report'
  | 'view_report'
  | 'background_review'
  | 'landlord_check';

export interface Issue {
  kind: IssueKind;
  criterionId: string;
  code: CriterionCode;
  /** Outcome of the criterion this issue belongs to (used for ordering). */
  outcome: Outcome;
  message: string;
  action: IssueAction;
}

export type ResultWarning = 'occupancy_local_code';

/** Numbers behind C1 (for "3.24×", "Short by $X/mo"). */
export interface IncomeMetrics {
  householdCents: Cents;
  rentForTestCents: Cents;
  voucherApplied: boolean;
  /** Ratio × 100, rounded once (half-up; floor when Not met so it never shows the required value). null when rentForTest = 0. */
  ratioHundredths: number | null;
  multipleTenths: number;
  /** Only when Not met. */
  shortByCents: Cents | null;
  usedDocuments: boolean;
}

export interface CriterionResult {
  criterionId: string;
  code: CriterionCode;
  /** Full criterion text (`criterionTitle`): S-04, published page, reasons, letters, Decision file. */
  title: string;
  /** Short name (`criterionShortTitle`): S-09 rows and the evidence sheet. */
  shortTitle: string;
  outcome: Outcome;
  /** null when there is nothing to grade (Missing / Not reviewed). */
  evidence: Evidence | null;
  source: EvidenceSource | null;
  /** Date of the verifying source (document checked, call, report date). */
  verifiedOn: IsoDate | null;
  /** One English sentence. */
  reason: string;
  issues: Issue[];
  warning: ResultWarning | null;
  income?: IncomeMetrics;
  /** C2: whole months counted. */
  historyMonths?: number;
}

export interface ApplicantSummary {
  /** No enabled criterion is Missing (C10 'not_reviewed' does not count). */
  ready: boolean;
  missingCount: number;
  /** "Ready to decide" or "N items missing". */
  text: string;
}

export interface ApplicantEvaluation {
  applicantId: string;
  results: CriterionResult[];
  /** Sorted: Mismatch → Needs review → Missing (Not met results are not issues). */
  issues: Issue[];
  summary: ApplicantSummary;
}
