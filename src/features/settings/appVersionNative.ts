/**
 * The installed app's version for S-21 / About (B-73): expo-application reads the binary (versionName / versionCode,
 * CFBundleShortVersionString / CFBundleVersion); expo-constants is the fallback. Pure part: ./about.ts.
 */
import * as Application from 'expo-application';
import Constants from 'expo-constants';

import { appVersion, type AppVersion } from './about';

export function currentAppVersion(): AppVersion {
  return appVersion({
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
    expoConfig: Constants.expoConfig,
    platform: Constants.platform,
  });
}
