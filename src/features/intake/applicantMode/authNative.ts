/** expo-local-authentication behind `LocalAuthAdapter` (mocked in Jest). */
import * as LocalAuthentication from 'expo-local-authentication';

import { withLockSuspended } from '@/features/settings/lockController';

import type { LocalAuthAdapter, SecurityLevel } from './auth';

const LEVELS: Record<number, SecurityLevel> = {
  [LocalAuthentication.SecurityLevel.NONE]: 'none',
  [LocalAuthentication.SecurityLevel.SECRET]: 'secret',
  [LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK]: 'biometric_weak',
  [LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG]: 'biometric_strong',
};

export const expoLocalAuthAdapter: LocalAuthAdapter = {
  async securityLevel() {
    return LEVELS[await LocalAuthentication.getEnrolledLevelAsync()] ?? 'none';
  },
  async authenticate({ promptMessage, cancelLabel }) {
    // The system biometric / passcode prompt is not "leaving the app" for App lock.
    const r = await withLockSuspended(() => LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false }));
    return r.success ? { success: true } : { success: false, error: r.error };
  },
};
