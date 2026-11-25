/* Phones stay portrait, tablets rotate — check the MainActivity patch and the iPad orientation list (pattern from A006 B-155). */
const { addTabletRotation, IPAD_ORIENTATIONS } = require('../withTabletRotation');

// onCreate as Expo prebuild writes it (SDK 58 template + expo-splash-screen).
const MAIN_ACTIVITY = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

describe('withTabletRotation', () => {
  it('lifts the portrait lock from 600dp smallest width, on create and on configuration change', () => {
    const out = addTabletRotation(MAIN_ACTIVITY);
    expect(out).toContain('super.onCreate(null)\n    applyOrientationForScreen(resources.configuration)\n  }');
    expect(out).toContain('override fun onConfigurationChanged(newConfig: android.content.res.Configuration)');
    expect(out).toContain('config.smallestScreenWidthDp >= 600');
    expect(out).toContain('SCREEN_ORIENTATION_UNSPECIFIED');
    expect(out).toContain('SCREEN_ORIENTATION_PORTRAIT');
    // Android 16+ large screens: getRequestedOrientation() reports the override, so the patch must not compare with it.
    expect(out).not.toContain('requestedOrientation != wanted');
    expect(out).toContain('if (appliedOrientation == wanted) return');
    expect(out).toContain('override fun getMainComponentName()');
  });

  it('is idempotent', () => {
    const once = addTabletRotation(MAIN_ACTIVITY);
    expect(addTabletRotation(once)).toBe(once);
  });

  it('fails the build instead of shipping a locked tablet when the template changes', () => {
    expect(() => addTabletRotation('class MainActivity : ReactActivity() {}')).toThrow(/did not match/);
  });

  it('gives iPad all four orientations', () => {
    expect([...IPAD_ORIENTATIONS].sort()).toEqual([
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
    ]);
  });
});
