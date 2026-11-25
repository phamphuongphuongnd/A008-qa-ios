/**
 * Shapes of the JSON columns in schema.ts. Plain data (no Date objects): dates 'YYYY-MM-DD', months 'YYYY-MM',
 * timestamps ISO, money integer cents.
 */

/**
 * Criterion parameters (C1 `{ multiple: 3.0, voucherShare: true }`, C2 `{ months: 12 }`…).
 * TODO(merge 1B): replace with the engine's params type (src/engine) — kept open here so both branches compile.
 */
export type CriterionParams = Record<string, unknown>;

export interface EmergencyContact {
  name?: string;
  phone?: string;
}

export interface OtherAdult {
  name: string;
}

export type PetKind = 'cat' | 'dog' | 'other';
export interface Pet {
  kind: PetKind;
  count: number;
  note?: string;
}

/** Yes / No questions of form part 5 (+ explanation when Yes) and answers to custom "Applicant answers" criteria. */
export interface YesNoAnswer {
  yes: boolean | null;
  explain?: string;
}
export type AnswerMap = Partial<Record<'evicted' | 'bankruptcy' | 'smokes', YesNoAnswer>> & Record<string, YesNoAnswer | undefined>;

export interface Consent {
  authorize: boolean;
  certify: boolean;
}

/** S-11 call script answers (keys q1…q9) / S-12 employer answers. Every field optional: filled as the call goes. */
export interface ReferenceAnswers {
  rented?: 'yes' | 'no' | 'wouldnt_say';
  fromMonth?: string;
  toMonth?: string;
  stillThere?: boolean;
  rentCents?: number;
  paidOnTime?: 'always' | 'mostly' | 'often_late' | 'wouldnt_say';
  violations?: 'no' | 'yes';
  violationsNote?: string;
  leftUnit?: 'good' | 'normal_wear' | 'damage' | 'still_living' | 'wouldnt_say';
  properNotice?: 'yes' | 'no' | 'still_living' | 'wouldnt_say';
  owes?: 'no' | 'yes' | 'wouldnt_say';
  owesCents?: number;
  rentAgain?: 'yes' | 'no' | 'wouldnt_say';
  rentAgainWhy?: string;
  // Employer (S-12)
  employed?: 'yes' | 'no' | 'wont_confirm';
  since?: string;
  jobTitle?: string;
}

export type EvictionOutcome = 'judgment' | 'settled' | 'dismissed' | 'applicant_won' | 'not_shown';
export interface EvictionRecord {
  /** 'YYYY' or 'YYYY-MM-DD'. */
  date: string;
  outcome: EvictionOutcome;
}

export type ConvictionType = 'violent' | 'property' | 'drug' | 'fraud' | 'other';
export interface Conviction {
  type: ConvictionType;
  convictedOn?: string;
  sentenceEndedOn?: string;
}
export interface BackgroundAssessment {
  seriousness?: string;
  rehabilitation?: string;
  other?: string;
}

/** Approve with conditions (S-15): each set one is a condition. */
export interface DecisionConditions {
  higherDepositCents?: number;
  cosigner?: boolean;
  higherRentCents?: number;
}

export type ItemCondition = 'good' | 'fair' | 'damaged';
export interface MoveInItem {
  name: string;
  condition?: ItemCondition;
  note?: string;
  photoPaths?: string[];
}
export interface MoveInRoom {
  name: string;
  items: MoveInItem[];
}
export interface MeterReadings {
  electric?: string;
  gas?: string;
  water?: string;
}
/** Relative paths of the SVG signatures (or null while unsigned). */
export interface MoveInSignatures {
  landlord?: { path: string; at: string } | null;
  tenant?: { path: string; at: string } | null;
}
