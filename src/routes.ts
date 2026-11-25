import type { Href } from 'expo-router';

/**
 * Every link between screens goes through these builders — never a hand-written path in a screen.
 * Owner: 1A / coordinator. A Phase 2 session that needs a new route or param asks the coordinator; the folders under
 * app/ follow PLAN.md Phase 2 (table: docs/ROUTES.md). Scheme for deep links: `evenlease://` + the same path.
 *
 * Ids are SQLite row ids. Query values are strings in the screen (`useLocalSearchParams`); parse with `parseId`.
 */
export type Id = number | string;

/** The landlord's application form has 7 sections (product.md S-08). */
export type FormSection = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Letter kinds (product.md S-16). */
export type LetterKind = 'adverse_action' | 'denial' | 'conditional_offer' | 'approval';

type Query = Record<string, string | number | boolean | undefined>;

function withQuery(path: string, query?: Query): Href {
  const parts = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return (parts.length ? `${path}?${parts.join('&')}` : path) as Href;
}

const seg = (id: Id) => encodeURIComponent(String(id));

export const routes = {
  // ── Tabs (product.md §4) ──────────────────────────────────────────────
  /** S-02 Rentals — tab 1, also the app's home `/`. */
  rentals: () => '/' as Href,
  /** S-25 Guide — tab 2. */
  guide: () => '/guide' as Href,
  /** S-25a one Guide article (other screens link straight to the article they explain). */
  guideArticle: (slug: string) => `/guide/${seg(slug)}` as Href,
  /** S-21 Settings — tab 3. */
  settings: () => '/settings' as Href,

  // ── 2E: onboarding ────────────────────────────────────────────────────
  /** S-01 Onboarding. */
  onboarding: () => '/onboarding' as Href,

  // ── 2A: rentals + criteria ────────────────────────────────────────────
  /** S-03 Rental editor — create. */
  rentalNew: () => '/units/new' as Href,
  /** S-03 Rental editor — edit. */
  rentalEdit: (rentalId: Id) => `/units/${seg(rentalId)}/edit` as Href,
  /** S-06 Rental hub. */
  rentalHub: (rentalId: Id) => `/units/${seg(rentalId)}` as Href,
  /** S-04 Criteria builder. `setup` = first pass right after creating the rental (S-03 → S-04 → S-05 → S-06). */
  criteria: (rentalId: Id, opts?: { setup?: boolean }) =>
    withQuery(`/units/${seg(rentalId)}/criteria`, { setup: opts?.setup ? 1 : undefined }),
  /** S-05 Published criteria (view / export PDF). */
  publishedCriteria: (rentalId: Id, opts?: { setup?: boolean }) =>
    withQuery(`/units/${seg(rentalId)}/published`, { setup: opts?.setup ? 1 : undefined }),

  // ── 2B: applications ──────────────────────────────────────────────────
  /** S-07 Add applicant (sheet). */
  addApplicant: (rentalId: Id) => withQuery('/applicants/add', { rentalId }),
  /** S-08 Application form, landlord entering a new application. */
  applicationNew: (rentalId: Id) => withQuery('/applicants/new', { rentalId }),
  /** S-08 Application form, landlord editing (optionally opening one section). */
  applicationEdit: (applicantId: Id, section?: FormSection) =>
    withQuery(`/applicants/${seg(applicantId)}/form`, { section }),
  /** S-08a Applicant mode — hand-over screen for one rental. */
  applicantModeStart: (rentalId: Id) => `/applicants/mode/start/${seg(rentalId)}` as Href,
  /** S-08 Application form inside Applicant mode (no tabs; leaving needs the landlord's lock). */
  applicantModeForm: (applicantId: Id, section?: FormSection) =>
    withQuery(`/applicants/mode/form/${seg(applicantId)}`, { section }),
  /** S-08b Applicant mode — done. */
  applicantModeDone: (applicantId: Id) => `/applicants/mode/done/${seg(applicantId)}` as Href,
  /** S-10 Documents. */
  documents: (applicantId: Id) => `/applicants/${seg(applicantId)}/documents` as Href,

  // ── 2C: verification ──────────────────────────────────────────────────
  /** S-11 Landlord reference — one call sheet per residence. */
  landlordReference: (applicantId: Id, residenceId: Id) =>
    `/verify/${seg(applicantId)}/landlord/${seg(residenceId)}` as Href,
  /** S-12 Employer reference — one per income source. */
  employerReference: (applicantId: Id, incomeId: Id) =>
    `/verify/${seg(applicantId)}/employer/${seg(incomeId)}` as Href,
  /** S-13 Screening report (external). */
  screeningReport: (applicantId: Id) => `/verify/${seg(applicantId)}/report` as Href,
  /** S-14 Background review (step 2, after a conditional offer). */
  backgroundReview: (applicantId: Id) => `/verify/${seg(applicantId)}/background` as Href,

  // ── 2D: review + decision ─────────────────────────────────────────────
  /** S-09 Applicant detail. */
  applicant: (applicantId: Id) => `/review/applicant/${seg(applicantId)}` as Href,
  /** S-15 Decision (sheet). */
  decision: (applicantId: Id) => `/review/applicant/${seg(applicantId)}/decision` as Href,
  /** S-16 Letter — for a decision (latest one when omitted), optionally preselecting the kind. */
  letter: (applicantId: Id, opts?: { decisionId?: Id; kind?: LetterKind }) =>
    withQuery(`/review/applicant/${seg(applicantId)}/letter`, { decisionId: opts?.decisionId, kind: opts?.kind }),
  /** S-17 Compare (Compare mode). */
  compare: (rentalId: Id) => `/review/rental/${seg(rentalId)}/compare` as Href,
  /** S-18 Order queue (First-come mode). Timer notifications open this. */
  orderQueue: (rentalId: Id) => `/review/rental/${seg(rentalId)}/queue` as Href,
  /** S-19 Decision file (PDF). */
  decisionFile: (rentalId: Id) => `/review/rental/${seg(rentalId)}/decision-file` as Href,

  // ── 2E: move-in + settings ────────────────────────────────────────────
  /** S-20 Move-in checklist for a rental (the approved applicant, when known). */
  moveIn: (rentalId: Id, applicantId?: Id) => withQuery(`/move-in/${seg(rentalId)}`, { applicantId }),
  /** S-22 Backup & restore. */
  backup: () => '/settings/backup' as Href,
  /** S-23 App lock. */
  appLock: () => '/settings/app-lock' as Href,
  /** S-24 Data cleanup. */
  dataCleanup: () => '/settings/cleanup' as Href,
  /** S-26 Legal & privacy. */
  legal: () => '/settings/legal' as Href,
  /** S-27 Delete all data. */
  deleteAll: () => '/settings/delete-all' as Href,

  // ── 1C ────────────────────────────────────────────────────────────────
  /** UI kit gallery (dev builds only). */
  gallery: () => '/dev/gallery' as Href,
} as const;

/** Route param → row id. Returns null for "new", missing or malformed values. */
export function parseId(value: string | string[] | undefined): number | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
