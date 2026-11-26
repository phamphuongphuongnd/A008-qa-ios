/**
 * Route guard of Applicant mode: while it is on, the only reachable screens are the three applicant-mode routes OF
 * THIS SESSION (its rental, its draft). Anything else (tabs, another applicant, a deep link, the system back) is sent
 * back to where the state machine says the applicant is.
 * Plugged into app/_layout.tsx at merge (`useApplicantModeGuard`) — TODO(merge 2B).
 */
import type { Href } from 'expo-router';

import { routeForState, type ModeState } from './machine';

const START = /^\/applicants\/mode\/start\/(\d+)\/?$/;
const FORM = /^\/applicants\/mode\/form\/(\d+)\/?$/;
const DONE = /^\/applicants\/mode\/done\/(\d+)\/?$/;

/** Path without query / hash ('/applicants/mode/form/12?section=3' → '/applicants/mode/form/12'). */
const pathOnly = (p: string) => p.split(/[?#]/)[0] || '/';

/** Route patterns allowed in Applicant mode (for docs / the layout's `gestureEnabled: false`). */
export const APPLICANT_MODE_ROUTES = ['/applicants/mode/start/[rentalId]', '/applicants/mode/form/[id]', '/applicants/mode/done/[id]'] as const;

/** True when `pathname` may be shown in state `s` (always true while the mode is off). */
export function isAllowedPath(pathname: string, s: ModeState): boolean {
  if (s.phase === 'off') return true;
  const p = pathOnly(pathname);
  const id = (re: RegExp) => {
    const m = re.exec(p);
    return m ? Number(m[1]) : null;
  };
  switch (s.phase) {
    case 'start':
      return id(START) === s.rentalId;
    case 'done':
      return id(DONE) === s.applicantId;
    default:
      return id(FORM) === s.applicantId;
  }
}

/** Where to `router.replace` to, or null when `pathname` is allowed. */
export function guardRedirect(pathname: string, s: ModeState): Href | null {
  return isAllowedPath(pathname, s) ? null : routeForState(s);
}

/** Data guard: in Applicant mode a screen may load only the session's applicant. */
export function canAccessApplicant(s: ModeState, applicantId: number | null | undefined): boolean {
  return s.phase === 'off' || (applicantId != null && applicantId === s.applicantId);
}
