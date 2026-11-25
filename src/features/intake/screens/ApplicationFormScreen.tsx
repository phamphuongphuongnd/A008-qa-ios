import { ScreenPlaceholder } from '@/navigation/ScreenPlaceholder';

/**
 * S-08 Application form (landlord + applicant mode) — product.md §5 S-08. Owner: Phase 2B.
 * Routes: /applicants/new?rentalId= (new, landlord) · /applicants/[id]/form?section= (landlord) ·
 * /applicants/mode/form/[id] (applicant mode: no tabs, no way out without the landlord's lock).
 */
export default function ApplicationFormScreen({ mode = 'landlord' }: { mode?: 'landlord' | 'applicant' }) {
  return <ScreenPlaceholder id="S-08" note={mode} />;
}
