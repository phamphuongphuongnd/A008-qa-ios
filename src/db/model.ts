/**
 * Shapes of the JSON columns in schema.ts. Plain data (no Date objects): dates 'YYYY-MM-DD', months 'YYYY-MM',
 * timestamps ISO, money integer cents. Where the engine (src/engine) has the type, the column stores exactly it.
 */
import type {
  Answer3,
  Conviction,
  Criterion,
  DecisionCondition,
  DecisionReason,
  EvictionCase,
  LandlordReference,
  PetEntry,
  YesNo,
} from '@/engine';

export type { Conviction, DecisionCondition, DecisionReason, EvictionCase };

/** `criteria.params`: the engine's params of the row's code. */
export type CriterionParams = Criterion['params'];

export interface EmergencyContact {
  name?: string;
  phone?: string;
}

export interface OtherAdult {
  name: string;
}

/** Engine PetEntry + an optional note ("Small dog"). */
export interface Pet extends PetEntry {
  note?: string;
}

/** Form part 5: Yes / No (null = not answered) + the explanation asked when Yes. */
export interface ApplicationAnswers {
  evicted: YesNo | null;
  bankruptcy: YesNo | null;
  smokes: YesNo | null;
  explain?: Partial<Record<'evicted' | 'bankruptcy' | 'smokes', string>>;
}

export interface Consent {
  authorize: boolean;
  certify: boolean;
}

/**
 * `references.answers`. Landlord sheet (S-11): the engine's LandlordReference field names (`answeredOn` = date of the
 * call) + the questions the rules don't read. Employer sheet (S-12): `employed`, `since`, `title`.
 */
export type ReferenceAnswers = Partial<Pick<LandlordReference, 'answeredOn' | 'rentedFromYou' | 'from' | 'to' | 'rentCents' | 'owes' | 'owesCents' | 'rentAgain'>> & {
  paidOnTime?: 'always' | 'mostly' | 'often_late' | 'wouldnt_say' | null;
  violations?: YesNo | null;
  violationsNote?: string | null;
  leftUnit?: 'good' | 'normal_wear' | 'damage' | 'still_living' | 'wouldnt_say' | null;
  properNotice?: 'yes' | 'no' | 'still_living' | 'wouldnt_say' | null;
  rentAgainWhy?: string | null;
  // Employer (S-12)
  employed?: 'yes' | 'no' | 'wont_confirm' | null;
  since?: string | null;
  title?: string | null;
};
export type { Answer3 };

export interface BackgroundAssessment {
  seriousness?: string | null;
  rehabilitation?: string | null;
  other?: string | null;
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
