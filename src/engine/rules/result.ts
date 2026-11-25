import type {
  Criterion,
  CriterionResult,
  Evidence,
  EvidenceSource,
  IncomeMetrics,
  IsoDate,
  Issue,
  IssueAction,
  Outcome,
  ResultWarning,
} from '../types';

export type RuleResult = CriterionResult;

export interface ResultOptions {
  outcome: Outcome;
  evidence?: Evidence | null;
  source?: EvidenceSource | null;
  verifiedOn?: IsoDate | null;
  reason: string;
  /** Action for the Missing / Needs review issue. */
  action?: IssueAction;
  /** Mismatch messages (each becomes an issue); evidence becomes 'mismatch' when any. */
  mismatches?: string[];
  mismatchAction?: IssueAction;
  warning?: ResultWarning | null;
  income?: IncomeMetrics;
  historyMonths?: number;
}

/** Builds a Criterion result and its own issues (Missing / Needs review / Mismatch). */
export function makeResult(c: Criterion, title: string, o: ResultOptions): RuleResult {
  const mismatches = o.mismatches ?? [];
  const evidence: Evidence | null = mismatches.length
    ? 'mismatch'
    : o.outcome === 'missing' || o.outcome === 'not_reviewed'
      ? null
      : (o.evidence ?? 'claimed');
  const issues: Issue[] = mismatches.map((message) => ({
    kind: 'mismatch',
    criterionId: c.id,
    code: c.code,
    outcome: o.outcome,
    message,
    action: o.mismatchAction ?? o.action ?? 'edit_application',
  }));
  if (o.outcome === 'missing' || o.outcome === 'needs_review') {
    issues.push({
      kind: o.outcome,
      criterionId: c.id,
      code: c.code,
      outcome: o.outcome,
      message: o.reason,
      action: o.action ?? 'edit_application',
    });
  }
  const r: RuleResult = {
    criterionId: c.id,
    code: c.code,
    title,
    outcome: o.outcome,
    evidence,
    source: o.outcome === 'missing' || o.outcome === 'not_reviewed' ? null : (o.source ?? 'application'),
    verifiedOn: evidence === 'verified' || evidence === 'mismatch' ? (o.verifiedOn ?? null) : null,
    reason: o.reason,
    issues,
    warning: o.warning ?? null,
  };
  if (o.income) r.income = o.income;
  if (o.historyMonths != null) r.historyMonths = o.historyMonths;
  return r;
}
