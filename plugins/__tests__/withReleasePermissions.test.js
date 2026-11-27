/* Release manifest: no network, overlay or push permissions; what backup, camera, reminders and lock need stays. */
const { REMOVE, releaseManifest } = require('../withReleasePermissions');

describe('withReleasePermissions', () => {
  it('removes network, overlay and push permissions from release', () => {
    for (const p of [
      'android.permission.INTERNET',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'com.google.android.c2dm.permission.RECEIVE',
      'com.google.android.gms.permission.AD_ID',
    ]) {
      expect(REMOVE).toContain(p);
      expect(releaseManifest()).toContain(`<uses-permission android:name="${p}" tools:node="remove"/>`);
    }
  });

  it('keeps what background backup, camera, reminders and App lock need', () => {
    for (const p of [
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ]) {
      expect(REMOVE).not.toContain(p);
    }
    expect(releaseManifest()).toContain('android:name="android.hardware.camera" android:required="false"');
  });

  it('B-104: no foreground service permission; storage write only up to Android 9 (camera)', () => {
    expect(REMOVE).toContain('android.permission.FOREGROUND_SERVICE');
    expect(releaseManifest()).toContain('<uses-permission android:name="android.permission.FOREGROUND_SERVICE" tools:node="remove"/>');
    expect(releaseManifest()).toContain(
      '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" tools:replace="android:maxSdkVersion"/>',
    );
  });
});
