import type { Href } from 'expo-router';

import { t } from '@/i18n';
import { routes } from '@/routes';

/**
 * Every screen of product.md §5: owner session (PLAN.md Phase 2), route file(s) under app/, the screen component under
 * src/features/, and a sample link (ids 1 / 2 — checked by tests).
 * Route files are thin shells: Phase 2 sessions edit their src/features/<area>/** and, if needed, the route files of
 * their own app/ folder. Root layout, tab layout and this table belong to 1A / the coordinator.
 */
type Owner = '2A' | '2B' | '2C' | '2D' | '2E';

export type ScreenInfo = {
  owner: Owner;
  routes: readonly string[];
  screen: string;
  sample: Href;
  title: () => string;
};

export const SCREENS = {
  'S-01': {
    owner: '2E',
    routes: ['app/onboarding/index.tsx'],
    screen: 'src/features/onboarding/screens/OnboardingScreen.tsx',
    sample: routes.onboarding(),
    title: () => t('system:s01.title'),
  },
  'S-02': {
    owner: '2A',
    routes: ['app/(tabs)/index.tsx'],
    screen: 'src/features/units/screens/RentalsScreen.tsx',
    sample: routes.rentals(),
    title: () => t('units:s02.title'),
  },
  'S-03': {
    owner: '2A',
    routes: ['app/units/new.tsx', 'app/units/[id]/edit.tsx'],
    screen: 'src/features/units/screens/RentalEditorScreen.tsx',
    sample: routes.rentalNew(),
    title: () => t('units:s03.title'),
  },
  'S-04': {
    owner: '2A',
    routes: ['app/units/[id]/criteria.tsx'],
    screen: 'src/features/criteria/screens/CriteriaBuilderScreen.tsx',
    sample: routes.criteria(1),
    title: () => t('units:s04.title'),
  },
  'S-05': {
    owner: '2A',
    routes: ['app/units/[id]/published.tsx'],
    screen: 'src/features/criteria/screens/PublishedCriteriaScreen.tsx',
    sample: routes.publishedCriteria(1),
    title: () => t('units:s05.title'),
  },
  'S-06': {
    owner: '2A',
    routes: ['app/units/[id]/index.tsx'],
    screen: 'src/features/units/screens/RentalHubScreen.tsx',
    sample: routes.rentalHub(1),
    title: () => t('units:s06.title'),
  },
  'S-07': {
    owner: '2B',
    routes: ['app/applicants/add.tsx'],
    screen: 'src/features/intake/screens/AddApplicantScreen.tsx',
    sample: routes.addApplicant(1),
    title: () => t('intake:s07.title'),
  },
  'S-08': {
    owner: '2B',
    routes: ['app/applicants/[id]/form.tsx', 'app/applicants/mode/form/[id].tsx'],
    screen: 'src/features/intake/screens/ApplicationFormScreen.tsx',
    sample: routes.applicationEdit(1, 1),
    title: () => t('intake:s08.title'),
  },
  'S-08a': {
    owner: '2B',
    routes: ['app/applicants/mode/start/[rentalId].tsx'],
    screen: 'src/features/intake/screens/ApplicantModeStartScreen.tsx',
    sample: routes.applicantModeStart(1),
    title: () => t('intake:s08a.title'),
  },
  'S-08b': {
    owner: '2B',
    routes: ['app/applicants/mode/done/[id].tsx'],
    screen: 'src/features/intake/screens/ApplicantModeDoneScreen.tsx',
    sample: routes.applicantModeDone(1),
    title: () => t('intake:s08b.title'),
  },
  'S-09': {
    owner: '2D',
    routes: ['app/review/applicant/[id]/index.tsx'],
    screen: 'src/features/decision/screens/ApplicantDetailScreen.tsx',
    sample: routes.applicant(1),
    title: () => t('decision:s09.title'),
  },
  'S-10': {
    owner: '2B',
    routes: ['app/applicants/[id]/documents.tsx'],
    screen: 'src/features/intake/screens/DocumentsScreen.tsx',
    sample: routes.documents(1),
    title: () => t('intake:s10.title'),
  },
  'S-11': {
    owner: '2C',
    routes: ['app/verify/[applicantId]/landlord/[residenceId].tsx'],
    screen: 'src/features/verify/screens/LandlordReferenceScreen.tsx',
    sample: routes.landlordReference(1, 1),
    title: () => t('verify:s11.title'),
  },
  'S-12': {
    owner: '2C',
    routes: ['app/verify/[applicantId]/employer/[incomeId].tsx'],
    screen: 'src/features/verify/screens/EmployerReferenceScreen.tsx',
    sample: routes.employerReference(1, 1),
    title: () => t('verify:s12.title'),
  },
  'S-13': {
    owner: '2C',
    routes: ['app/verify/[applicantId]/report.tsx'],
    screen: 'src/features/verify/screens/ScreeningReportScreen.tsx',
    sample: routes.screeningReport(1),
    title: () => t('verify:s13.title'),
  },
  'S-14': {
    owner: '2C',
    routes: ['app/verify/[applicantId]/background.tsx'],
    screen: 'src/features/verify/screens/BackgroundReviewScreen.tsx',
    sample: routes.backgroundReview(1),
    title: () => t('verify:s14.title'),
  },
  'S-15': {
    owner: '2D',
    routes: ['app/review/applicant/[id]/decision.tsx'],
    screen: 'src/features/decision/screens/DecisionScreen.tsx',
    sample: routes.decision(1),
    title: () => t('decision:s15.title'),
  },
  'S-16': {
    owner: '2D',
    routes: ['app/review/applicant/[id]/letter.tsx'],
    screen: 'src/features/decision/screens/LetterScreen.tsx',
    sample: routes.letter(1, { kind: 'adverse_action' }),
    title: () => t('decision:s16.title'),
  },
  'S-17': {
    owner: '2D',
    routes: ['app/review/rental/[id]/compare.tsx'],
    screen: 'src/features/decision/screens/CompareScreen.tsx',
    sample: routes.compare(1),
    title: () => t('decision:s17.title'),
  },
  'S-18': {
    owner: '2D',
    routes: ['app/review/rental/[id]/queue.tsx'],
    screen: 'src/features/decision/screens/OrderQueueScreen.tsx',
    sample: routes.orderQueue(1),
    title: () => t('decision:s18.title'),
  },
  'S-19': {
    owner: '2D',
    routes: ['app/review/rental/[id]/decision-file.tsx'],
    screen: 'src/features/decision/screens/DecisionFileScreen.tsx',
    sample: routes.decisionFile(1),
    title: () => t('decision:s19.title'),
  },
  'S-20': {
    owner: '2E',
    routes: ['app/move-in/[rentalId].tsx'],
    screen: 'src/features/movein/screens/MoveInScreen.tsx',
    sample: routes.moveIn(1, 2),
    title: () => t('system:s20.title'),
  },
  'S-21': {
    owner: '2E',
    routes: ['app/(tabs)/settings.tsx'],
    screen: 'src/features/settings/screens/SettingsScreen.tsx',
    sample: routes.settings(),
    title: () => t('system:s21.title'),
  },
  'S-21a': {
    owner: '2E',
    routes: ['app/settings/about.tsx'],
    screen: 'src/features/settings/screens/AboutScreen.tsx',
    sample: routes.about(),
    title: () => t('system:about.title'),
  },
  'S-22': {
    owner: '2E',
    routes: ['app/settings/backup.tsx'],
    screen: 'src/features/settings/screens/BackupScreen.tsx',
    sample: routes.backup(),
    title: () => t('system:s22.title'),
  },
  'S-23': {
    owner: '2E',
    routes: ['app/settings/app-lock.tsx'],
    screen: 'src/features/settings/screens/AppLockScreen.tsx',
    sample: routes.appLock(),
    title: () => t('system:s23.title'),
  },
  'S-24': {
    owner: '2E',
    routes: ['app/settings/cleanup.tsx'],
    screen: 'src/features/settings/screens/DataCleanupScreen.tsx',
    sample: routes.dataCleanup(),
    title: () => t('system:s24.title'),
  },
  'S-25': {
    owner: '2E',
    routes: ['app/(tabs)/guide.tsx'],
    screen: 'src/features/guide/screens/GuideScreen.tsx',
    sample: routes.guide(),
    title: () => t('guide:s25.title'),
  },
  'S-25a': {
    owner: '2E',
    routes: ['app/guide/[slug].tsx'],
    screen: 'src/features/guide/screens/GuideArticleScreen.tsx',
    sample: routes.guideArticle('how-evenlease-works'),
    title: () => t('guide:s25a.title'),
  },
  'S-26': {
    owner: '2E',
    routes: ['app/settings/legal.tsx'],
    screen: 'src/features/settings/screens/LegalScreen.tsx',
    sample: routes.legal(),
    title: () => t('system:s26.title'),
  },
  'S-27': {
    owner: '2E',
    routes: ['app/settings/delete-all.tsx'],
    screen: 'src/features/settings/screens/DeleteAllScreen.tsx',
    sample: routes.deleteAll(),
    title: () => t('system:s27.title'),
  },
} as const satisfies Record<string, ScreenInfo>;

export type ScreenId = keyof typeof SCREENS;
export const SCREEN_IDS = Object.keys(SCREENS) as ScreenId[];
