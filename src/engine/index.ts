/**
 * Evenlease engine — pure TypeScript, no React / Expo / DB. Money in integer cents. No total score, no ranking.
 * See README.md in this folder; rules: product.md §3.
 */
export * from './types';

/** Money + dates. */
export {
  PERIODS_PER_YEAR,
  divCeil,
  divHalfUp,
  formatMultiple,
  formatPercentDiff,
  formatRatio,
  formatUsd,
  payToMonthly,
  percentDiff,
} from './money';
export { dateOf, formatDate, formatMonth, instantMs, minusYears, wholeYearsBetween } from './dates';

/** Criteria: defaults, titles, validation, lock & history (§3.2, §3.12, §3.13). */
export {
  CRITERION_CODES,
  DOC_TYPE_LABELS,
  MAX_CUSTOM_CRITERIA,
  MAX_CUSTOM_TITLE,
  activeCriteria,
  criterionTitle,
  customTitleError,
  defaultCriteria,
  describeCriteriaChanges,
  editCriteria,
  isCriteriaLocked,
  requiredDocLabel,
  validateCriteria,
} from './criteria';
export type { CriteriaEditResult, CriteriaError, CriteriaErrorCode, CriteriaHistoryEntry } from './criteria';

/** Guardrails (§3.12). */
export {
  PROHIBITED_MESSAGE,
  PROHIBITED_TERMS,
  WARNING_MESSAGES,
  criteriaWarnings,
  findProhibitedTerms,
  reviewModeHint,
} from './guardrails';
export type { CriteriaWarning, CriteriaWarningCode } from './guardrails';

/** Evaluation (§3.1) + Compare (S-17). */
export { byReceived, compareApplicants, evaluateApplicant, evaluateCriterion, sortIssues, summarize } from './evaluate';
export type { CompareCell, CompareTable } from './evaluate';

/** Rule helpers the screens need (S-10, S-11, S-14). */
export { documentMonthlyCents, documentsForIncome, incomeCheck, isIncomeMismatch } from './rules/income';
export type { IncomeCheck } from './rules/income';
export {
  DATE_TOLERANCE_DAYS,
  RENT_TOLERANCE_PERCENT,
  c4Residence,
  canMarkUnreachable,
  compareReferenceDates,
  compareReferenceRent,
  referenceRedFlags,
  rentalHistoryMonths,
  residenceGaps,
} from './rules/history';
export type { DateCheck, RedFlag } from './rules/history';
export { APPLICATION_EVICTION_YEARS } from './rules/report';
export { OCCUPANCY_WARNING, documentProgress, occupancyLimit } from './rules/household';
export type { DocumentProgress } from './rules/household';
export { NOT_REVIEWED_TEXT, convictionsInLookback, missingAssessment, yearsSince } from './rules/background';
export type { AssessmentField } from './rules/background';

/** First-come order + timers (§3.14). */
export {
  FINAL_STATUSES,
  FIRST_COME_PUBLISHED_TEXT,
  NOTIFY_BEFORE_HOURS,
  TIMER_HOURS,
  buildQueue,
  closeTurn,
  decisionGate,
  startTimer,
  timerNotifications,
  timerState,
} from './firstCome';
export type {
  DecisionGate,
  Queue,
  QueueAction,
  QueueApplicant,
  QueueEntry,
  QueueState,
  Timer,
  TimerKind,
  TimerNotification,
  TimerState,
  TimerStatus,
  TurnChange,
} from './firstCome';

/** Decisions + FCRA (§3.15). */
export {
  ADVERSE_KINDS,
  FCRA_REQUIRED_LINES,
  MISSING_INFO_WARNING,
  defaultReportInfluenced,
  letterData,
  noticeRequirement,
  reasonOptions,
  validateDecision,
} from './decision';
export type {
  CompanyField,
  ConditionKind,
  DecisionCheck,
  DecisionCondition,
  DecisionErrorCode,
  DecisionInput,
  DecisionKind,
  DecisionReason,
  LetterData,
  LetterKind,
  NoticeRequirement,
  ScoreBlock,
} from './decision';

/** §8 sample rental (also seeds the DB). */
export { SAMPLE, SAMPLE_APPLICANTS, SAMPLE_CRITERIA, SAMPLE_RENTAL } from './fixtures/sample';
export type { SampleApplicant, SampleRental } from './fixtures/sample';
