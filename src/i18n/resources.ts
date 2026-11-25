import common from './en/common.json';
import decision from './en/decision.json';
import guide from './en/guide.json';
import intake from './en/intake.json';
import system from './en/system.json';
import ui from './en/ui.json';
import units from './en/units.json';
import verify from './en/verify.json';

/**
 * One namespace per file so the parallel sessions never edit the same JSON:
 * - common   — shared words (tabs, actions, "not legal advice"). 1A / coordinator only; add keys sparingly.
 * - ui       — UI kit: status badges, a11y labels of shared components (1C)
 * - units    — S-02…S-06: rentals + criteria, published-criteria PDF (2A)
 * - intake   — S-07, S-08, S-08a, S-08b, S-10: application form, applicant mode, documents, blank PDF (2B)
 * - verify   — S-11…S-14: reference calls, screening report, background review (2C)
 * - decision — S-09, S-15…S-19: applicant summary, decision, letters, compare, order queue, decision file,
 *              timer notifications (2D)
 * - system   — S-01, S-20…S-24, S-26, S-27: onboarding, move-in, settings, backup, lock, cleanup, reminders (2E)
 * - guide    — S-25 Guide list + article texts (2E)
 * A new language = a new folder next to `en/` with the same files, added below.
 */
export const resources = {
  en: { common, ui, units, intake, verify, decision, system, guide },
} as const;

export const namespaces = ['common', 'ui', 'units', 'intake', 'verify', 'decision', 'system', 'guide'] as const;
export type Namespace = (typeof namespaces)[number];
export const defaultNS = 'common' satisfies Namespace;
