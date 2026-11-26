# 2A — Rentals + criteria (F-02, F-03 · S-02…S-06)

Logic (tested with `makeTestDb()`); screens use the hooks. Repos are imported directly (not `@/db`, which opens the phone DB).

## units/
- `rentalForm.ts` — `RentalForm` (money in cents), `emptyRentalForm`, `rentalToForm`, `validateRental` / `validateRentalField`
  (→ `units:s03.errors.*` keys), `firstErrorField`, `formToRentalValues`, `isRentalFormDirty`, `rentalModeHint` (WA).
- `rentalService.ts` — `createRentalFromForm` (rental + §3.2 default criteria), `updateRentalFromForm(db, id, form, { confirmModeChange })`
  (mode switch with received applicants → `{ confirm: ModeChangePlan }` first, then recorded in criteria history
  `{ reviewMode }`; to Compare resolves running timers → `stoppedTimers` to cancel), `planReviewModeChange`, `closeRental`,
  `reopenRental`, `deleteRentalAndData(db, files, id)` (sample → removeSampleRental), `deleteRentalMessage`, `openSampleRental`.
  `askNotifications` = first time First-come is on (§6).
- `rentalSummary.ts` — `deriveRentalStatus` (DB keeps open / closed; Approved → Leased, Conditional offer → Offer out),
  `summarizeRental` ("4 applicants · 2 ready to decide" / "decision made"), `hubApplicantRows` (received order, `#n` in
  First-come), `moveInApplicantId`, `initials`.
- `rentalQueries.ts` — `loadRentalCards(db, 'open'|'closed')` (S-02), `loadRentalHub(db, id)` (S-06),
  `loadRentalsReminders(db, now)` (backup > 30 days with real data · closed rentals holding data), `RENTAL_LIVE_TABLES`.
- `format.ts` — address / city / rent / "Available Jan 1" / "Received Dec 2, 9:14 AM" / labels. `usStates.ts` — 50 + DC.
- `hooks.ts` — `useRentals(filter)`, `useRentalsReminders()` (Later = this session), `useRentalHub(id)`, `useRentalForm(id|null)`, `useRentalActions()`.

## criteria/
- `criteriaEditor.ts` — S-04 reducer: phases editing / locked / unlocking / unlocked (reason), toggle, step / setNumber
  (`PARAM_RANGES`), voucher-off dialog (`pendingVoucher`), C7 < 2 warning card (dismiss), pet policy, C6 documents,
  custom yes/no (engine guardrail, ≤ 5). Selectors: `isDirty`, `canSave`, `visibleWarnings`, `draftErrors`, `customAddError`, `stepLimits`.
- `criteriaService.ts` — `loadCriteria`, `saveCriteriaDraft(db, id, draft, { reason, smokingPolicy })` (engine `editCriteria`;
  locked → history `{ criteria: Criterion[] }` with row ids), `describeHistoryEntry` / `criteriaHistoryLines` (Decision file).
- `criteriaRows.ts` — engine ↔ `saveCriteria` rows. `clipboard.ts` — `copyText(text, adapter?)`.
- `hooks.ts` — `useCriteriaEditor(id)`, `usePublishedCriteria(id)` (content + `sharePdf` + `copy`).

## src/pdf/publishedCriteria.ts
`publishedCriteriaContent(rental, criteria)` → one model for the S-05 preview, `publishedCriteriaHtml` (shell, footer),
`publishedCriteriaText` (Copy as text), `sharePublishedCriteriaPdf(content, { adapter })`.
