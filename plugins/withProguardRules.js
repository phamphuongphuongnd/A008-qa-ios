/**
 * Release (R8) keep rules — A008 B-100.
 *
 * Expo SDK 58 prebuild turns R8 on for release (`android.enableMinifyInReleaseBuilds=true`, full mode by default with
 * AGP 8+). The release APK crashed at launch: `NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init>`.
 * expo-background-task (weekly backup) pulls work-runtime 2.10.5 → room-runtime 2.6.1, whose consumer rule
 * `-keep class * extends androidx.room.RoomDatabase` keeps the class but not its no-arg constructor, which Room calls
 * by reflection (`Room.databaseBuilder(...).build()` → `Class.newInstance`). Room 2.7 fixed its rule; until then we add
 * it here. `android/` is generated (CNG), so the rules go in through this plugin, between markers (idempotent).
 *
 * Also kept, for the same reason (created by reflection / by name, not reached from code R8 can see):
 * - WorkManager workers and input mergers (class names are stored in WorkManager's database and rebuilt by reflection;
 *   work-runtime ships rules for these — restated so an upgrade that drops them cannot break the backup job).
 * - expo-sqlite's Kotlin side (called from its C++ / JSI layer).
 * expo-notifications, expo-background-task, expo-task-manager and expo-modules-core ship their own consumer rules.
 *
 * Check: `npx expo prebuild -p android --no-install` then `android/app/proguard-rules.pro`; a release build with R8
 * must open on the phone (cần build release R8 + mở trên máy).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const BEGIN = '# @evenlease-proguard-begin (plugins/withProguardRules.js — do not edit by hand)';
const END = '# @evenlease-proguard-end';

const RULES = [
  '# Room (via androidx.work): the generated *_Impl databases are built by reflection with the no-arg constructor.',
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
  '# WorkManager: workers and input mergers are instantiated by class name.',
  '-keep class * extends androidx.work.ListenableWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }',
  '-keep class * extends androidx.work.InputMerger { public <init>(); }',
  '# expo-sqlite: Kotlin classes reached from native code.',
  '-keep class expo.modules.sqlite.** { *; }',
];

const block = () => [BEGIN, ...RULES, END].join('\n');

/** `src` with our block replaced / appended (exactly once). */
function applyRules(src) {
  const start = src.indexOf(BEGIN);
  let base = src;
  if (start !== -1) {
    const end = src.indexOf(END, start);
    base = src.slice(0, start) + (end === -1 ? '' : src.slice(end + END.length));
  }
  base = base.replace(/\s*$/, '');
  return `${base ? `${base}\n\n` : ''}${block()}\n`;
}

function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      fs.writeFileSync(file, applyRules(src));
      return cfg;
    },
  ]);
}

module.exports = withProguardRules;
module.exports.RULES = RULES;
module.exports.applyRules = applyRules;
