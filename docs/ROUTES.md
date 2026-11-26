# Evenlease — routes & file ownership

Source of truth in code: `src/navigation/screens.ts` (table + sample links, checked by tests) and `src/routes.ts`
(typed href builders — screens link to each other **only** through `routes.*`). Deep links: `evenlease://<path>`.

Every file under `app/` is a thin shell that re-exports a screen from `src/features/<area>/screens/`. A Phase 2 session
edits its own `src/features/<area>/**` (and its own `app/<folder>/**` if a route needs options). `app/_layout.tsx`,
`app/(tabs)/**`, `src/routes.ts`, `src/navigation/**` and `src/i18n/en/common.json` belong to 1A / the coordinator:
ask before changing them (new route, new param, sheet options).

| Screen | Path | Route file(s) | Screen file | i18n ns | Phase |
|---|---|---|---|---|---|
| S-01 Onboarding | `/onboarding` | `app/onboarding/index.tsx` | `features/onboarding/screens/OnboardingScreen` | system | 2E |
| S-02 Rentals (tab 1) | `/` | `app/(tabs)/index.tsx` | `features/units/screens/RentalsScreen` | units | 2A |
| S-03 Rental editor | `/units/new` · `/units/[id]/edit` | `app/units/new.tsx`, `app/units/[id]/edit.tsx` | `features/units/screens/RentalEditorScreen` | units | 2A |
| S-04 Criteria builder | `/units/[id]/criteria?setup=1` | `app/units/[id]/criteria.tsx` | `features/criteria/screens/CriteriaBuilderScreen` | units | 2A |
| S-05 Published criteria | `/units/[id]/published?setup=1` | `app/units/[id]/published.tsx` | `features/criteria/screens/PublishedCriteriaScreen` | units | 2A |
| S-06 Rental hub | `/units/[id]` | `app/units/[id]/index.tsx` | `features/units/screens/RentalHubScreen` | units | 2A |
| S-07 Add applicant (sheet) | `/applicants/add?rentalId=` | `app/applicants/add.tsx` | `features/intake/screens/AddApplicantScreen` | intake | 2B |
| S-08 Application form | `/applicants/[id]/form?section=` · `/applicants/mode/form/[id]` (S-07 creates the draft first) | `app/applicants/[id]/form.tsx`, `app/applicants/mode/form/[id].tsx` (`mode="applicant"`) | `features/intake/screens/ApplicationFormScreen` | intake | 2B |
| S-08a Applicant mode — start | `/applicants/mode/start/[rentalId]` | `app/applicants/mode/start/[rentalId].tsx` | `features/intake/screens/ApplicantModeStartScreen` | intake | 2B |
| S-08b Applicant mode — done | `/applicants/mode/done/[id]` | `app/applicants/mode/done/[id].tsx` | `features/intake/screens/ApplicantModeDoneScreen` | intake | 2B |
| S-09 Applicant detail | `/review/applicant/[id]` | `app/review/applicant/[id]/index.tsx` | `features/decision/screens/ApplicantDetailScreen` | decision | 2D |
| S-10 Documents | `/applicants/[id]/documents` | `app/applicants/[id]/documents.tsx` | `features/intake/screens/DocumentsScreen` | intake | 2B |
| S-11 Landlord reference | `/verify/[applicantId]/landlord/[residenceId]` | `app/verify/[applicantId]/landlord/[residenceId].tsx` | `features/verify/screens/LandlordReferenceScreen` | verify | 2C |
| S-12 Employer reference | `/verify/[applicantId]/employer/[incomeId]` | `app/verify/[applicantId]/employer/[incomeId].tsx` | `features/verify/screens/EmployerReferenceScreen` | verify | 2C |
| S-13 Screening report | `/verify/[applicantId]/report` | `app/verify/[applicantId]/report.tsx` | `features/verify/screens/ScreeningReportScreen` | verify | 2C |
| S-14 Background review | `/verify/[applicantId]/background` | `app/verify/[applicantId]/background.tsx` | `features/verify/screens/BackgroundReviewScreen` | verify | 2C |
| S-15 Decision (sheet) | `/review/applicant/[id]/decision` | `app/review/applicant/[id]/decision.tsx` | `features/decision/screens/DecisionScreen` | decision | 2D |
| S-16 Letter | `/review/applicant/[id]/letter?decisionId=&kind=` | `app/review/applicant/[id]/letter.tsx` | `features/decision/screens/LetterScreen` | decision | 2D |
| S-17 Compare | `/review/rental/[id]/compare` | `app/review/rental/[id]/compare.tsx` | `features/decision/screens/CompareScreen` | decision | 2D |
| S-18 Order queue | `/review/rental/[id]/queue` | `app/review/rental/[id]/queue.tsx` | `features/decision/screens/OrderQueueScreen` | decision | 2D |
| S-19 Decision file | `/review/rental/[id]/decision-file` | `app/review/rental/[id]/decision-file.tsx` | `features/decision/screens/DecisionFileScreen` | decision | 2D |
| S-20 Move-in checklist | `/move-in/[rentalId]?applicantId=` | `app/move-in/[rentalId].tsx` | `features/movein/screens/MoveInScreen` | system | 2E |
| S-21 Settings (tab 3) | `/settings` | `app/(tabs)/settings.tsx` | `features/settings/screens/SettingsScreen` | system | 2E |
| S-21a About | `/settings/about` | `app/settings/about.tsx` | `features/settings/screens/AboutScreen` | system | 2E |
| S-22 Backup & restore | `/settings/backup` | `app/settings/backup.tsx` | `features/settings/screens/BackupScreen` | system | 2E |
| S-23 App lock | `/settings/app-lock` | `app/settings/app-lock.tsx` | `features/settings/screens/AppLockScreen` | system | 2E |
| S-24 Data cleanup | `/settings/cleanup` | `app/settings/cleanup.tsx` | `features/settings/screens/DataCleanupScreen` | system | 2E |
| S-25 Guide (tab 2) | `/guide` | `app/(tabs)/guide.tsx` | `features/guide/screens/GuideScreen` | guide | 2E |
| S-25a Guide article | `/guide/[slug]` | `app/guide/[slug].tsx` | `features/guide/screens/GuideArticleScreen` | guide | 2E |
| S-26 Legal & privacy | `/settings/legal` | `app/settings/legal.tsx` | `features/settings/screens/LegalScreen` | system | 2E |
| S-27 Delete all data | `/settings/delete-all` | `app/settings/delete-all.tsx` | `features/settings/screens/DeleteAllScreen` | system | 2E |
| UI kit gallery | `/dev/gallery` | `app/dev/gallery.tsx` | (1C) | ui | 1C |

Navigation shape: root `Stack` = `(tabs)` (Rentals · Guide · Settings, tab bar only there) + every other screen pushed
above it. Sheets (`formSheet`): S-07, S-15. Applicant mode routes have `gestureEnabled: false`; the guard that keeps the
applicant inside `applicants/mode/*` and the onboarding / App lock gates are plugged into `app/_layout.tsx` at merge.

Other folders: `src/engine` (1B) · `src/db`, `src/ui`, `src/theme`, `app/dev` (1C) · `src/pdf` (per file: 2A/2B/2D/2E) ·
`src/backup` + background task import in `index.ts` (2E) · `assets/` (2E).
