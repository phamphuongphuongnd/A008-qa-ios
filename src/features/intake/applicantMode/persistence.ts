/** Applicant mode session stored in settings (`applicantMode`), so a restart comes back into the session. */
import { getSetting, updateSettings } from '@/db/repos/settings';
import type { AppDb } from '@/db/types';

import type { ModePersistence } from './store';

export function settingsPersistence(db: AppDb): ModePersistence {
  return {
    load: () => getSetting(db, 'applicantMode'),
    save: (state) => updateSettings(db, { applicantMode: state }),
  };
}
