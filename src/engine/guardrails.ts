/**
 * Criteria guardrails (§3.12): prohibited terms for custom criteria and decision reasons, and warnings on risky settings.
 */
import type { Criterion } from './types';

/** §3.12 list, verbatim. Matched case-insensitively, as whole words, with plural forms. */
export const PROHIBITED_TERMS = [
  'race', 'color', 'religion', 'church', 'christian', 'muslim', 'jewish', 'national origin', 'nationality', 'citizen',
  'immigrant', 'accent', 'english', 'sex', 'gender', 'pregnant', 'pregnancy', 'children', 'kids', 'family', 'married',
  'single', 'disability', 'disabled', 'wheelchair', 'age', 'old', 'young', 'senior', 'section 8', 'voucher', 'welfare',
  'ssi', 'ssdi',
] as const;

export const PROHIBITED_MESSAGE =
  'This looks like it could screen on a protected characteristic or source of income. Fair housing laws prohibit that.';

/** Irregular singular / plural forms. "children" and "kids" are listed in the plural, so their singulars are blocked too. */
const EXTRA_FORMS: Record<string, string[]> = {
  children: ['child'],
  kids: ['kid'],
  family: ['families'],
  pregnancy: ['pregnancies'],
  disability: ['disabilities'],
  nationality: ['nationalities'],
};

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term: string): string {
  const words = term.split(' ').map(escape);
  // last word may take a plural -s / -es; words are joined by spaces or hyphens ("section-8", "section 8")
  const body = words.join('[\\s-]*');
  const forms = [`${body}(?:s|es)?`, ...(EXTRA_FORMS[term] ?? []).map(escape)];
  return `(?:${forms.join('|')})`;
}

const MATCHERS = PROHIBITED_TERMS.map((term) => ({
  term,
  // no look-behind: keeps the pattern portable across JS engines
  re: new RegExp(`(?:^|[^A-Za-z0-9])${termPattern(term)}(?![A-Za-z0-9])`, 'i'),
}));

/** Listed terms found in `text` (canonical spelling, in list order). [] = allowed. */
export function findProhibitedTerms(text: string): string[] {
  return MATCHERS.filter((m) => m.re.test(text)).map((m) => m.term);
}

export type CriteriaWarningCode = 'voucher_off' | 'occupancy_below_two' | 'credit_enabled' | 'criminal_local_law';

export interface CriteriaWarning {
  code: CriteriaWarningCode;
  criterionId: string;
  message: string;
}

export const WARNING_MESSAGES: Record<CriteriaWarningCode, string> = {
  voucher_off:
    "In 23 states, DC and many cities, refusing or disadvantaging voucher holders is illegal. Keep it on unless you're sure it doesn't apply.",
  // §3.12 "cảnh báo tương tự (familial status)" — wording mirrors the voucher warning.
  occupancy_below_two:
    "Fewer than 2 people per bedroom can screen out families with children, who are protected by fair housing laws. Keep it at 2 or more unless you're sure your local code requires less.",
  credit_enabled:
    'Many renters with vouchers or no credit history have low or no scores. Some states limit this criterion.',
  criminal_local_law:
    'Only convictions. Reviewed after a conditional offer. Some cities ban this step (e.g. Oakland, Berkeley) or delay it (NYC, Maryland). Check local law.',
};

/** Warnings to show on S-04 for the current settings (enabled criteria only). */
export function criteriaWarnings(criteria: readonly Criterion[]): CriteriaWarning[] {
  const out: CriteriaWarning[] = [];
  const add = (code: CriteriaWarningCode, criterionId: string) =>
    out.push({ code, criterionId, message: WARNING_MESSAGES[code] });
  for (const c of criteria) {
    if (!c.enabled) continue;
    if (c.code === 'C1' && !c.params.applyToTenantShare) add('voucher_off', c.id);
    if (c.code === 'C7' && c.params.perBedroom < 2) add('occupancy_below_two', c.id);
    if (c.code === 'C9') add('credit_enabled', c.id);
    if (c.code === 'C10') add('criminal_local_law', c.id);
  }
  return out;
}

/** S-03: state WA → orange hint (never switches the mode). */
export function reviewModeHint(state: string | null | undefined): string | null {
  return state?.toUpperCase() === 'WA' ? 'Seattle requires first-come order.' : null;
}
