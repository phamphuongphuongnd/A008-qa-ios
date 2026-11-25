/**
 * Release-only manifest overrides (android/app/src/release/AndroidManifest.xml has the highest merge priority).
 *
 * Evenlease is offline: no server, no account, no ads, no analytics, no crash reporting. Applicant data never leaves
 * the phone except through the system share sheet / print dialog and the backup file the landlord writes to a folder
 * they picked (Android SAF → the Drive app's document provider uploads it; Evenlease itself needs no INTERNET).
 * Opening a screening service or county records uses the system browser (Linking) — no permission either.
 *
 * Debug / dev-client builds keep INTERNET (Metro) and SYSTEM_ALERT_WINDOW (dev menu), so the removals below happen in
 * the release manifest only. Permissions no build ever needs are in app.json `android.blockedPermissions`.
 *
 * Kept on purpose:
 * - ACCESS_NETWORK_STATE — expo-background-task schedules WorkManager with NetworkType.CONNECTED and JobScheduler
 *   throws SecurityException without it (Android 9+) → automatic weekly backup (fact expo-native-v2-gotchas).
 * - CAMERA — document photos (expo-image-picker). Declared not required as hardware (uses-feature below).
 * - POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK — local 72 h / 48 h timers, backup and cleanup
 *   reminders (expo-notifications reschedules after a reboot). No exact alarms: a few minutes late is fine.
 * - USE_BIOMETRIC, USE_FINGERPRINT — App lock and leaving Applicant mode (expo-local-authentication).
 * TODO(6B): `aapt2 dump permissions` on the release APK before filling in Play Data safety.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const REMOVE = [
  // Network: the app never goes online. Dev builds need it for Metro.
  'android.permission.INTERNET',
  'android.permission.ACCESS_WIFI_STATE',
  // Dev menu overlay.
  'android.permission.SYSTEM_ALERT_WINDOW',
  // Push (FCM) and Play install referrer — local notifications only, no attribution.
  'com.google.android.c2dm.permission.RECEIVE',
  'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
  'com.google.android.gms.permission.AD_ID',
  // Launcher badge permissions (ShortcutBadger, pulled in by expo-notifications). The app sets no icon badge.
  'android.permission.READ_APP_BADGE',
  'com.sec.android.provider.badge.permission.READ',
  'com.sec.android.provider.badge.permission.WRITE',
  'com.htc.launcher.permission.READ_SETTINGS',
  'com.htc.launcher.permission.UPDATE_SHORTCUT',
  'com.sonyericsson.home.permission.BROADCAST_BADGE',
  'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE',
  'com.anddoes.launcher.permission.UPDATE_COUNT',
  'com.majeur.launcher.permission.UPDATE_BADGE',
  'com.huawei.android.launcher.permission.CHANGE_BADGE',
  'com.huawei.android.launcher.permission.READ_SETTINGS',
  'com.huawei.android.launcher.permission.WRITE_SETTINGS',
  'com.oppo.launcher.permission.READ_SETTINGS',
  'com.oppo.launcher.permission.WRITE_SETTINGS',
  'me.everything.badger.permission.BADGE_COUNT_READ',
  'me.everything.badger.permission.BADGE_COUNT_WRITE',
];

/** Hardware Play must not treat as required (would hide the app from devices without it). */
const OPTIONAL_FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus'];

const releaseManifest = () =>
  [
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
    '    xmlns:tools="http://schemas.android.com/tools">',
    ...REMOVE.map((p) => `    <uses-permission android:name="${p}" tools:node="remove"/>`),
    // A006 QA-100 B-115: on Android 9 and older expo-image-picker's camera also needs WRITE_EXTERNAL_STORAGE.
    '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" tools:replace="android:maxSdkVersion"/>',
    ...OPTIONAL_FEATURES.map(
      (f) => `    <uses-feature android:name="${f}" android:required="false" tools:replace="android:required"/>`,
    ),
    '</manifest>',
    '',
  ].join('\n');

function withReleasePermissions(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'release');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'AndroidManifest.xml'), releaseManifest());
      return cfg;
    },
  ]);
}

module.exports = withReleasePermissions;
module.exports.REMOVE = REMOVE;
module.exports.releaseManifest = releaseManifest;
