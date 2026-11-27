/**
 * The phone side of App lock: expo-local-authentication behind a tiny adapter (Jest mocks this file).
 * Fact expo-native-v2-gotchas (A006 B-53): a deep link arriving while the prompt is open can leave `authenticateAsync`
 * pending forever — the Unlock button calls `cancel()` before asking again.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

import { biometricKind, type AuthCapability } from './lock';

export type AuthResult = 'success' | 'cancel' | 'lockout' | 'unavailable' | 'failed';

export interface AuthAdapter {
  capability(): Promise<AuthCapability>;
  /** System prompt: biometrics, falling back to the phone's passcode. */
  authenticate(promptMessage: string, cancelLabel: string): Promise<AuthResult>;
  cancel(): Promise<void>;
}

export const expoAuthAdapter: AuthAdapter = {
  async capability() {
    try {
      const [level, types] = await Promise.all([
        LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      const T = LocalAuthentication.AuthenticationType;
      const L = LocalAuthentication.SecurityLevel;
      const enrolled = level === L.BIOMETRIC_STRONG || level === L.BIOMETRIC_WEAK;
      // B-103: never "Face unlock" when the prompt will really ask for a fingerprint (lock.ts biometricKind).
      const biometric = biometricKind(
        enrolled,
        { face: types.includes(T.FACIAL_RECOGNITION), fingerprint: types.includes(T.FINGERPRINT), iris: types.includes(T.IRIS) },
        Platform.OS === 'ios',
      );
      return { biometric, deviceSecure: level !== L.NONE };
    } catch {
      return { biometric: null, deviceSecure: false };
    }
  },
  async authenticate(promptMessage, cancelLabel) {
    try {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
      if (r.success) return 'success';
      switch (r.error) {
        case 'user_cancel':
        case 'system_cancel':
        case 'app_cancel':
        case 'user_fallback':
          return 'cancel';
        case 'lockout':
          return 'lockout';
        case 'not_enrolled':
        case 'not_available':
        case 'passcode_not_set':
          return 'unavailable';
        default:
          return 'failed';
      }
    } catch {
      return 'failed';
    }
  },
  async cancel() {
    try {
      await LocalAuthentication.cancelAuthenticate();
    } catch {
      // Nothing open.
    }
  },
};
