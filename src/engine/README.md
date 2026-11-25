# src/engine — Evenlease rules (1B)

Pure TypeScript (no React / Expo / SQLite). Import only from `@/engine` (`index.ts`). Rules: `product.md` §3; terms:
`CONTEXT.md`. **No total score, no ranking anywhere** — Compare columns follow received order.

## Units
- Money: integer cents. Intermediate values exact; rounded to the cent once at the end (pay stub → monthly half-up;
  "Short by" rounded up). Ratio shown with 2 decimals, half-up — but a Not met ratio is floored so it never shows the
  required value (2.996 → "2.99×").
- C1 multiple stored in tenths (`multipleTenths: 30` = 3.0×) so the ≥ test is exact integer math.
- Dates `YYYY-MM-DD`, months `YYYY-MM`, timestamps ISO with the device offset. "Date received" = date part of `receivedAt`.
- Nothing reads the clock: First-come functions take `now`. Timers are absolute hours (DST moves the wall clock ±1 h);
  `endsAt` is UTC ISO, format it in local time.

## Inputs (map DB rows to these; 1C)
`RentalInput` · `Criterion[]` (discriminated by `code`, `params` = DB `params` JSON; `id` = row id; `CX` = custom) ·
`ApplicantInput` { residences, incomes, documents, landlordReferences (+attempts), employerReferences, report,
background, answers, customAnswers, landlordChecks, conditionalOfferAt }. Schema notes for 1C:
- `documents` needs `income_id` (which income a proof-of-income document proves) and `monthly_cents`
  ("Monthly amount on this document" for offer / benefits letters).
- `references.answers` JSON uses the `LandlordReference` field names; `answeredOn` = date of the call.
- `reports.evictions` `[]` = None found, `null` = not entered; `landlord_collections_cents` `0` = None, `null` = not entered.
- Applicant status adds `offer_expired` (First-come "Offer expired — move to next").
- `background.outcome` / timers: see `Timer` (`kind`, `startedAt`, `endsAt`, `resolvedAt`).

## API
- `evaluateApplicant(rental, criteria, applicant)` → `{ results[], issues[], summary }` (S-09). Result: `outcome`
  (met / not_met / missing / needs_review / not_reviewed for C10 before an offer), `evidence` (claimed / verified /
  mismatch / null), `source`, `verifiedOn`, `reason`, `issues`, `warning`, `income` (C1 numbers), `historyMonths` (C2).
  `summary.text` = "Ready to decide" | "N items missing" (counts Missing only). Issues = Mismatch / Needs review / Missing
  only (Not met is never an issue), sorted in that order; each has an `action` (`add_documents`, `call_landlord`, `add_report`, …) for the S-09 button.
- `compareApplicants(rental, criteria, applicants, { hideClosed })` (S-17).
- Criteria (S-04): `defaultCriteria`, `criterionTitle`, `validateCriteria`, `customTitleError`, `criteriaWarnings`,
  `findProhibitedTerms`, `reviewModeHint`; lock/history: `isCriteriaLocked`, `editCriteria`, `describeCriteriaChanges`.
- Screens: `incomeCheck`, `payToMonthly` (S-10), `documentProgress` (S-09/S-10), `referenceRedFlags`,
  `canMarkUnreachable` (S-11), `missingAssessment`, `yearsSince` (S-14).
- First-come (S-18): `buildQueue(applicants, now)`, `decisionGate`, `startTimer`, `timerState`, `timerNotifications`,
  `closeTurn`.
- Decision (S-15/S-16): `reasonOptions`, `defaultReportInfluenced`, `validateDecision`, `noticeRequirement`,
  `letterData`, `FCRA_REQUIRED_LINES`.
- `SAMPLE` (`fixtures/sample.ts`): §8 sample rental with stable ids (`sample-rental`, `sample-c1…`, `sample-a1…a4`).

## Decided by Phương 2026-11-25 (written into product.md §3 / §8)
- C1: voucher "Yes" with a blank amount → Missing.
- C4: no rented residence (owned / lived with family) → Needs review "your call".
- Custom yes/no: yes → Met, no → Not met, blank → Missing; applicant answers = Claimed, landlord checks = Verified.
- Report company in the sample: `REPORT_ADDRESS_PLACEHOLDER` / `REPORT_PHONE_PLACEHOLDER`; never unverified real details.
- Issues = Missing / Needs review / Mismatch only ("Landlord identity not confirmed" is a Needs review issue).
- C8 template default "Pets considered case by case"; the §8 sample rental stays "Cats and dogs, max 2".

## Engine assumptions (product.md silent)
- C1: several checked documents for one income source → the lowest monthly amount counts; an unlinked document counts
  only when there is one source.
- C2 Verified needs the landlord's from + to for the longest Rent/Own residence (owner confirmation is C4's job).
- C3: lookback applies to all cases; a year-only date in the cutoff year is "maybe inside" (judgment → Needs review).
- C5: sources disagree → Not met + Mismatch.
- C10: lookback counted from the Conditional offer date by conviction date; source = screening report.
- §3.12 list also blocks singular "child" / "kid" and irregular plurals (families, pregnancies…).
