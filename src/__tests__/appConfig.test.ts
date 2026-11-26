/**
 * Step 4 QA (TESTCASES §10 / offline / "N of M Met"): store promises of product.md §10 and APP.md checked on the shipped config and source.
 * Offline, no ads / analytics / crash reporting, no storage permission, Android Auto Backup off, dark splash,
 * monochrome icon, and applicant data never logged.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const releasePlugin = fs.readFileSync(path.join(ROOT, 'plugins/withReleasePermissions.js'), 'utf8');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'testing' || e.name === 'fixtures' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const SOURCES = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'app'))];
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/');

describe('§10 store config (app.json)', () => {
  it('names the app Evenlease 1.0.0, follows the phone theme', () => {
    expect(app.name).toBe('Evenlease');
    expect(app.version).toBe('1.0.0');
    expect(app.userInterfaceStyle).toBe('automatic');
  });

  it('Android: Auto Backup off for applicant data, adaptive + monochrome icon on indigo', () => {
    expect(app.android.allowBackup).toBe(false);
    expect(app.android.adaptiveIcon.monochromeImage).toBeTruthy();
    expect(app.android.adaptiveIcon.backgroundColor.toLowerCase()).toBe('#4f46e5');
  });

  it('asks for no storage, media, contacts, location, phone or billing permission', () => {
    const blocked: string[] = app.android.blockedPermissions;
    for (const p of [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_CONTACTS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.RECORD_AUDIO',
      'com.android.vending.BILLING',
    ])
      expect(blocked).toContain(p);
  });

  it('release build drops INTERNET, push and the advertising id', () => {
    for (const p of ['android.permission.INTERNET', 'com.google.android.c2dm.permission.RECEIVE', 'com.google.android.gms.permission.AD_ID'])
      expect(releasePlugin).toContain(`'${p}'`);
  });

  it('camera and Face ID texts say what they are for; no microphone', () => {
    const plugin = (name: string) => app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)?.[1];
    expect(plugin('expo-image-picker').cameraPermission).toMatch(/documents/i);
    expect(plugin('expo-image-picker').microphonePermission).toBe(false);
    expect(plugin('expo-local-authentication').faceIDPermission).toMatch(/applicant mode/i);
  });

  it('splash has a light and a dark background', () => {
    const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.backgroundColor.toLowerCase()).toBe('#f6f7fb');
    expect(splash.dark.backgroundColor.toLowerCase()).toBe('#0f1117');
  });
});

describe('offline, no ads, no tracking (APP.md, §10 Data safety)', () => {
  it('ships no ad, analytics, crash-report, auth or network SDK', () => {
    const deps = Object.keys(pkg.dependencies);
    const banned = /sentry|bugsnag|crashlytics|firebase|analytics|amplitude|mixpanel|segment|admob|ads|appsflyer|branch|axios|apollo|supabase|auth0|revenuecat|purchases|iap/i;
    expect(deps.filter((d) => banned.test(d))).toEqual([]);
  });

  it('source never calls the network', () => {
    const hits = SOURCES.filter((f) => /\bfetch\(|XMLHttpRequest|new WebSocket|EventSource/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(hits).toEqual([]);
  });

  it('source never logs (applicant data must not reach the console / crash logs)', () => {
    const hits = SOURCES.filter((f) => /console\.(log|info|debug|warn|error)\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(hits).toEqual([]);
  });

  it('"N of M Met" is used by the Decision file only (§3.1, Phương 2026-11-26)', () => {
    const users = SOURCES.filter((f) => /metCount/.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(users.sort()).toEqual(['src/features/decision/decisionFile.ts', 'src/features/decision/viewModel.ts']);
    const screens = SOURCES.filter((f) => /screens|components|[\\/]ui[\\/]|^app/.test(rel(f)));
    expect(screens.filter((f) => /metCount|decisionFile\.metCount/.test(fs.readFileSync(f, 'utf8'))).map(rel)).toEqual([]);
  });
});
