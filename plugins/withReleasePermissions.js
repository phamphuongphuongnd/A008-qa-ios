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
 *   reminders (expo-notifications reschedules after a reboot).
 * - SCHEDULE_EXACT_ALARM (app.json `android.permissions`; never USE_EXACT_ALARM) — the First-come "2 hours left" /
 *   "time is up" reminders of the 72 h / 48 h clocks fire on time (inexact alarms can be ~1 h late). Android 14+ asks
 *   the landlord in "Alarms & reminders" (src/notifications/exactAlarms.ts); denied = inexact, the app works the same.
 *   Play declaration (Bước 6): see apps/A008-evenlease report fix-decision.
 * - USE_BIOMETRIC, USE_FINGERPRINT — App lock and leaving Applicant mode (expo-local-authentication).
 * - WRITE_EXTERNAL_STORAGE maxSdkVersion 28 — camera document photos on Android 9 and older (see releaseManifest).
 * Removed in release besides the list below: FOREGROUND_SERVICE (B-104, no foreground service).
 * A13 release APK (2026-11-27, `aapt2 dump permissions`): ACCESS_LOCAL_NETWORK / CHANGE_WIFI_MULTICAST_STATE are dev-client
 * only. Re-run `aapt2 dump permissions` on the store build before Play Data safety.
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
  // B-104: WorkManager (work-runtime, via expo-background-task) declares it for SystemForegroundService, used only by
  // workers that call setForeground(). The weekly backup worker never does, and Evenlease has no foreground service —
  // without it Play asks no foreground-service type declaration (Android 14+).
  'android.permission.FOREGROUND_SERVICE',
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
    // Kept on purpose (B-104): A006 QA-100 B-115 — on Android 9 and older (still installable) expo-image-picker's camera
    // writes the photo to shared storage and needs WRITE_EXTERNAL_STORAGE. Capped at maxSdkVersion 28: on Android 10+
    // the permission is not requested at all.
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
