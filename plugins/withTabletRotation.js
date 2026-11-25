/**
 * Phones stay portrait; tablets rotate freely.
 *
 * `orientation: "portrait"` in app.json locks every device: an Android tablet held landscape showed the app as a
 * phone-sized strip with black bars (and a squeezed keyboard), and iPad could only be used upright. Every screen is
 * already inside the centred 640-wide column, so landscape on a tablet just widens the side margins.
 *
 * - Android: the manifest keeps `screenOrientation="portrait"` (phones never flash sideways at launch); MainActivity
 *   lifts the lock when the window's smallest width is ≥ 600 dp (the usual tablet line) and puts it back below that
 *   (foldable folded, phone-sized split screen). smallestScreenWidthDp doesn't change on rotation, so no loop.
 *   Android 16+ already ignores the lock on ≥ 600 dp screens for apps targeting SDK 36; this covers older tablets
 *   and keeps the behaviour the same on all of them.
 * - iOS: iPhone keeps the portrait list from `orientation`; iPad gets all four orientations
 *   (`UISupportedInterfaceOrientations~ipad`). `requireFullScreen` stays true (no Split View / Slide Over on
 *   iPadOS ≤ 26; iOS 27 resizes windows anyway and the layout follows the window size).
 */
const { withInfoPlist, withMainActivity } = require('expo/config-plugins');

const IPAD_ORIENTATIONS = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
];

const MARKER = 'applyOrientationForScreen';

function addTabletRotation(src) {
  if (src.includes(MARKER)) return src;
  let out = src.replace(
    /\n    super\.onCreate\(null\)\n  \}\n/,
    `
    super.onCreate(null)
    ${MARKER}(resources.configuration)
  }

  // Phones stay portrait (manifest); tablets (smallest width >= 600dp) rotate freely.
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    ${MARKER}(newConfig)
  }

  // Remember what we asked for: on Android 16+ large screens getRequestedOrientation() reports the system's
  // override, not the manifest's portrait, so comparing against it would skip the call.
  private var appliedOrientation: Int? = null

  private fun ${MARKER}(config: android.content.res.Configuration) {
    val wanted = if (config.smallestScreenWidthDp >= 600) {
      android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    } else {
      android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }
    if (appliedOrientation == wanted) return
    appliedOrientation = wanted
    requestedOrientation = wanted
  }
`,
  );
  if (!out.includes(MARKER)) throw new Error('withTabletRotation: MainActivity.kt did not match');
  return out;
}

function withAndroid(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') throw new Error('withTabletRotation: MainActivity must be Kotlin');
    cfg.modResults.contents = addTabletRotation(cfg.modResults.contents);
    return cfg;
  });
}

function withIos(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults['UISupportedInterfaceOrientations~ipad'] = IPAD_ORIENTATIONS;
    return cfg;
  });
}

module.exports = (config) => withIos(withAndroid(config));
module.exports.addTabletRotation = addTabletRotation;
module.exports.IPAD_ORIENTATIONS = IPAD_ORIENTATIONS;
