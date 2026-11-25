/**
 * SQLite schema (product.md §7). Money: INTEGER cents (`…_cents`). Dates: ISO 'YYYY-MM-DD'; months 'YYYY-MM';
 * timestamps: ISO 8601 with the phone's offset ('2026-12-02T09:14:00-05:00'). JSON columns hold small typed objects
 * (types in ./model.ts). File paths are RELATIVE to the app's document directory ('applicants/12/id-1.jpg').
 * No SSN, no date of birth, no protected characteristic anywhere — never add such a column.
 * Change → `npx drizzle-kit generate` (new SQL in drizzle/, bundled by drizzle/migrations.js, run at app start).
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type {
  ApplicantStatus,
  AttemptMethod,
  AttemptResult,
  ConfirmSource,
  CriterionCode,
  DecisionKind,
  DocType,
  PayFrequency,
  ResidenceType,
  TimerKind,
} from '@/engine';

import type {
  ApplicationAnswers,
  BackgroundAssessment,
  Consent,
  Conviction,
  CriterionParams,
  DecisionCondition,
  DecisionReason,
  EmergencyContact,
  EvictionCase,
  MeterReadings,
  MoveInRoom,
  MoveInSignatures,
  OtherAdult,
  Pet,
  ReferenceAnswers,
} from './model';

export type { ApplicantStatus, AttemptMethod, AttemptResult, ConfirmSource, CriterionCode, DecisionKind, PayFrequency, ResidenceType, TimerKind };

const now = sql`(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;
const id = () => integer('id').primaryKey({ autoIncrement: true });
const bool = (name: string) => integer(name, { mode: 'boolean' });
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

// ---------------- Rentals + criteria ----------------

export type ReviewMode = 'compare' | 'first_come';
export type RentalStatus = 'open' | 'offer_out' | 'leased' | 'closed';
export type SmokingPolicy = 'non_smoking' | 'outside' | 'allowed';

export const rentals = sqliteTable('rentals', {
  id: id(),
  street: text('street').notNull(),
  unit: text('unit'),
  city: text('city'),
  /** Two-letter code (50 states + DC). */
  state: text('state'),
  zip: text('zip'),
  rentCents: integer('rent_cents').notNull(),
  /** 0 = studio (counts as 1 for C7). */
  bedrooms: integer('bedrooms').notNull().default(1),
  /** 1, 1.5, 2… */
  bathrooms: real('bathrooms'),
  availableOn: text('available_on'),
  depositCents: integer('deposit_cents'),
  feeCents: integer('fee_cents').notNull().default(0),
  smokingPolicy: text('smoking_policy').$type<SmokingPolicy>().notNull().default('non_smoking'),
  notes: text('notes'),
  reviewMode: text('review_mode').$type<ReviewMode>().notNull().default('compare'),
  status: text('status').$type<RentalStatus>().notNull().default('open'),
  createdAt: text('created_at').notNull().default(now),
  closedAt: text('closed_at'),
  /** "Explore with a sample rental" (§8): removable in one tap, never counted by data-cleanup reminders. */
  isSample: bool('is_sample').notNull().default(false),
});

/** One row per criterion of a rental: C1…C10 (§3.2) and custom yes/no ones ('CX', up to 5; title in params). */
export const criteria = sqliteTable(
  'criteria',
  {
    id: id(),
    rentalId: integer('rental_id')
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    /** Engine `CriterionCode`: 'C1'…'C10', or 'CX' for a custom yes/no criterion (several per rental). */
    code: text('code').$type<CriterionCode>().notNull(),
    enabled: bool('enabled').notNull().default(true),
    /** The engine's params of that code (C1 `{ multipleTenths: 30, applyToTenantShare: true }`, CX `{ title, answeredBy }`). */
    params: json<CriterionParams>('params').notNull().default(sql`'{}'`),
    order: integer('order').notNull().default(0),
  },
  (t) => [index('criteria_rental').on(t.rentalId, t.order)],
);

/** §3.13: every change after the criteria locked (≥ 1 applicant): when, before → after, why. */
export const criteriaHistory = sqliteTable(
  'criteria_history',
  {
    id: id(),
    rentalId: integer('rental_id')
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    at: text('at').notNull(),
    before: json<unknown>('before'),
    after: json<unknown>('after'),
    reason: text('reason').notNull(),
  },
  (t) => [index('criteria_history_rental').on(t.rentalId)],
);

// ---------------- Applicants + application ----------------

export type ApplicantSource = 'landlord' | 'applicant_mode' | 'paper';

export const applicants = sqliteTable(
  'applicants',
  {
    id: id(),
    rentalId: integer('rental_id')
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    /** First save of the application (applicant mode: when they tapped Submit). Never edited after (§3.14). */
    receivedAt: text('received_at').notNull(),
    status: text('status').$type<ApplicantStatus>().notNull().default('new'),
    source: text('source').$type<ApplicantSource>().notNull().default('landlord'),
    /** Applicant mode: the draft isn't submitted yet (not in the queue, not counted). */
    draft: bool('draft').notNull().default(false),
    /** Last form part reached (1–7), to reopen a draft where it was left. */
    formStep: integer('form_step').notNull().default(1),
    // 1. About you
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    emergency: json<EmergencyContact>('emergency'),
    // 2. Household
    occupants: integer('occupants'),
    otherAdults: json<OtherAdult[]>('other_adults'),
    pets: json<Pet[]>('pets'),
    moveInOn: text('move_in_on'),
    /** null = not answered. */
    hasVoucher: bool('has_voucher'),
    voucherCents: integer('voucher_cents'),
    voucherProgram: text('voucher_program'),
    // 5. A few questions
    answers: json<ApplicationAnswers>('answers'),
    /** Custom "Applicant answers" criteria: criterion row id (as string) → yes / no / null. */
    customAnswers: json<Record<string, boolean | null>>('custom_answers'),
    /** Custom "Landlord checks" criteria: criterion row id (as string) → yes / no / null. */
    landlordChecks: json<Record<string, boolean | null>>('landlord_checks'),
    // 6. Consent & signature
    consent: json<Consent>('consent'),
    signaturePath: text('signature_path'),
    signedName: text('signed_name'),
    signedAt: text('signed_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
    /** Disposal (S-24 / S-09 delete): personal data erased, row kept as "Applicant 3 — data deleted Jan 10". */
    deletedAt: text('deleted_at'),
  },
  (t) => [index('applicants_rental').on(t.rentalId, t.receivedAt)],
);


/** 3. Where you've lived (past 3 years). */
export const residences = sqliteTable(
  'residences',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    address: text('address').notNull(),
    fromMonth: text('from_month'),
    /** null with `current` = "I live here now". */
    toMonth: text('to_month'),
    current: bool('current').notNull().default(false),
    type: text('type').$type<ResidenceType>(),
    rentCents: integer('rent_cents'),
    landlordName: text('landlord_name'),
    landlordPhone: text('landlord_phone'),
    landlordEmail: text('landlord_email'),
    reason: text('reason'),
  },
  (t) => [index('residences_applicant').on(t.applicantId)],
);

export type IncomeKind = 'employment' | 'self_employment' | 'benefits' | 'child_support' | 'retirement' | 'other' | 'other_adult';

/** 4. Work & income: the job, other income lines, and other adults' income (`person`). */
export const incomes = sqliteTable(
  'incomes',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<IncomeKind>().notNull(),
    employer: text('employer'),
    title: text('title'),
    startOn: text('start_on'),
    /** Gross (before taxes). */
    monthlyCents: integer('monthly_cents'),
    phone: text('phone'),
    supervisor: text('supervisor'),
    /** Other adult's name (kind other_adult). */
    person: text('person'),
    order: integer('order').notNull().default(0),
  },
  (t) => [index('incomes_applicant').on(t.applicantId)],
);

/** Engine DocType + 'paper_form' (photos of a paper application, S-08 landlord only — not a C6 document). */
export type DocumentType = DocType | 'paper_form';

/** S-10. One row per file. */
export const documents = sqliteTable(
  'documents',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    type: text('type').$type<DocumentType>().notNull(),
    /** "Other" type typed name. */
    label: text('label'),
    /** Relative to the document directory: 'applicants/{id}/…'. */
    filePath: text('file_path').notNull(),
    mime: text('mime'),
    addedAt: text('added_at').notNull().default(now),
    /** "Mark as checked" (by you). */
    checkedAt: text('checked_at'),
    /** Proof of income: the income line it proves (null = the only one, if there is one). */
    incomeId: integer('income_id').references(() => incomes.id, { onDelete: 'set null' }),
    /** Income check on a pay stub. */
    payGrossCents: integer('pay_gross_cents'),
    payFrequency: text('pay_frequency').$type<PayFrequency>(),
    /** Offer / benefits letter: "Monthly amount on this document". */
    monthlyCents: integer('monthly_cents'),
  },
  (t) => [index('documents_applicant').on(t.applicantId)],
);

// ---------------- Verification ----------------

export type ReferenceKind = 'landlord' | 'employer';

/** S-11 / S-12 reference sheet (one per residence for landlords). */
export const references = sqliteTable(
  'references',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ReferenceKind>().notNull(),
    residenceId: integer('residence_id').references(() => residences.id, { onDelete: 'set null' }),
    incomeId: integer('income_id').references(() => incomes.id, { onDelete: 'set null' }),
    /** Who was reached (name / company as found by the landlord). */
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    ownerConfirmed: bool('owner_confirmed').notNull().default(false),
    confirmSource: text('confirm_source').$type<ConfirmSource>(),
    answers: json<ReferenceAnswers>('answers'),
    notes: text('notes'),
    unreachable: bool('unreachable').notNull().default(false),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('references_applicant').on(t.applicantId)],
);


export const attempts = sqliteTable(
  'attempts',
  {
    id: id(),
    referenceId: integer('reference_id')
      .notNull()
      .references(() => references.id, { onDelete: 'cascade' }),
    at: text('at').notNull(),
    method: text('method').$type<AttemptMethod>().notNull(),
    result: text('result').$type<AttemptResult>().notNull(),
  },
  (t) => [index('attempts_reference').on(t.referenceId)],
);

/** S-13: key results of an outside screening report (the report itself is a file). */
export const reports = sqliteTable(
  'reports',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    /** 'mysmartmove' | 'checkr' | 'other'. */
    service: text('service'),
    companyName: text('company_name'),
    companyAddress: text('company_address'),
    companyPhone: text('company_phone'),
    reportDate: text('report_date'),
    /** [] = "None found"; null = not entered yet. */
    evictions: json<EvictionCase[]>('evictions'),
    /** 0 = None; null = not entered yet. */
    landlordCollectionsCents: integer('landlord_collections_cents'),
    score: integer('score'),
    noScore: bool('no_score').notNull().default(false),
    scoreModel: text('score_model'),
    scoreRange: text('score_range'),
    scoreDate: text('score_date'),
    keyFactors: json<string[]>('key_factors'),
    filePaths: json<string[]>('file_paths'),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('reports_applicant').on(t.applicantId)],
);

/** S-14 step 2 (after a conditional offer): convictions only + individual assessment. */
export const background = sqliteTable(
  'background',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    noConvictions: bool('no_convictions').notNull().default(false),
    convictions: json<Conviction[]>('convictions'),
    assessment: json<BackgroundAssessment>('assessment'),
    reviewedOn: text('reviewed_on'),
    outcome: text('outcome').$type<'continue' | 'withdraw'>(),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('background_applicant').on(t.applicantId)],
);

// ---------------- Decisions, letters, timers, move-in ----------------

export type NoticeStatus = 'not_required' | 'pending' | 'created' | 'sent';

export const decisions = sqliteTable(
  'decisions',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<DecisionKind>().notNull(),
    conditions: json<DecisionCondition[]>('conditions'),
    /** Criteria ticked as reasons, with the source of their result (engine `DecisionReason`). */
    reasons: json<DecisionReason[]>('reasons'),
    note: text('note'),
    /** "Information from a screening report played a part in this decision". */
    reportInfluenced: bool('report_influenced').notNull().default(false),
    at: text('at').notNull(),
    noticeRequired: bool('notice_required').notNull().default(false),
    /** "Notice pending" until the FCRA letter is exported (S-15). */
    noticeStatus: text('notice_status').$type<NoticeStatus>().notNull().default('not_required'),
  },
  (t) => [index('decisions_applicant').on(t.applicantId)],
);

export type LetterKind = 'adverse_action' | 'denial' | 'conditional_offer' | 'approval';
export type SentMethod = 'email' | 'text' | 'mail' | 'in_person';

export const letters = sqliteTable(
  'letters',
  {
    id: id(),
    decisionId: integer('decision_id')
      .notNull()
      .references(() => decisions.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<LetterKind>().notNull(),
    /** Editable opening / closing text; the FCRA block is rebuilt from the data, never stored editable. */
    body: text('body'),
    pdfPath: text('pdf_path'),
    createdAt: text('created_at').notNull().default(now),
    sentAt: text('sent_at'),
    sentMethod: text('sent_method').$type<SentMethod>(),
  },
  (t) => [index('letters_decision').on(t.decisionId)],
);


/** First-come clocks (§3.14): 72 h missing info, 48 h offer. */
export const timers = sqliteTable(
  'timers',
  {
    id: id(),
    applicantId: integer('applicant_id')
      .notNull()
      .references(() => applicants.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<TimerKind>().notNull(),
    startedAt: text('started_at').notNull(),
    endsAt: text('ends_at').notNull(),
    resolvedAt: text('resolved_at'),
    /** How the applicant was told (Request missing info). */
    method: text('method'),
    /** Scheduled local notification ids, to cancel when resolved. */
    notificationIds: json<string[]>('notification_ids'),
  },
  (t) => [index('timers_applicant').on(t.applicantId)],
);

/** S-20 move-in checklist (one per rental + approved applicant). */
export const movein = sqliteTable(
  'movein',
  {
    id: id(),
    rentalId: integer('rental_id')
      .notNull()
      .references(() => rentals.id, { onDelete: 'cascade' }),
    applicantId: integer('applicant_id').references(() => applicants.id, { onDelete: 'set null' }),
    handoverOn: text('handover_on'),
    rooms: json<MoveInRoom[]>('rooms'),
    meters: json<MeterReadings>('meters'),
    keys: integer('keys'),
    alarmsTested: bool('alarms_tested'),
    signatures: json<MoveInSignatures>('signatures'),
    pdfPath: text('pdf_path'),
    updatedAt: text('updated_at').notNull().default(now),
    doneAt: text('done_at'),
  },
  (t) => [index('movein_rental').on(t.rentalId)],
);

/** Key → JSON value (see repos/settings.ts for keys and defaults). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
