/**
 * S-21 About (mockup v2 "S-21 · About"), as pure data: version line, licenses, feedback link.
 */
import { t } from '@/i18n';

/**
 * Support email for "Send feedback" (a mailto link). Empty in 1.0: the row is hidden until a support email exists —
 * enable it by setting the address here.
 */
export const FEEDBACK_EMAIL = '';

/** mailto link for "Send feedback", or null (row hidden) while there is no support email. */
export function feedbackMailto(email: string = FEEDBACK_EMAIL): string | null {
  const e = email.trim();
  return e ? `mailto:${e}?subject=${encodeURIComponent(t('system:about.feedbackSubject'))}` : null;
}

/**
 * Where the version line reads from. Native values first (expo-application: what the installed binary says — the
 * build number EAS gave it, B-73), then app config via expo-constants (dev / tests).
 */
export interface VersionSource {
  nativeApplicationVersion?: string | null;
  nativeBuildVersion?: string | null;
  expoConfig?: { version?: string | null } | null;
  platform?: { android?: { versionCode?: number | null } | null; ios?: { buildNumber?: string | null } | null } | null;
}

export interface AppVersion {
  /** "1.0.0" in full (B-73: support needs the exact version). */
  version: string | null;
  /** "1" — Android versionCode / iOS CFBundleVersion; null in tests. */
  build: string | null;
}

const filled = (v: string | number | null | undefined): string | null => (v != null && String(v).trim() !== '' ? String(v).trim() : null);

export function appVersion(c: VersionSource): AppVersion {
  return {
    version: filled(c.nativeApplicationVersion) ?? filled(c.expoConfig?.version),
    build: filled(c.nativeBuildVersion) ?? filled(c.platform?.android?.versionCode) ?? filled(c.platform?.ios?.buildNumber),
  };
}

/** "Version 1.0.0 (1)" · "Version 1.0.0" without a build number · null without a version. */
export function versionLabel(v: AppVersion): string | null {
  if (!v.version) return null;
  return v.build ? t('system:about.versionBuild', { version: v.version, build: v.build }) : t('system:s21.version', { version: v.version });
}

/** Line under the logo (mockup "Version 1.0 (1) · No account · No servers"): "Version 1.0.0 (1) · No account · No servers". */
export function aboutLine(v: AppVersion): string {
  return [versionLabel(v), t('system:about.noAccount')].filter(Boolean).join(' · ');
}

/**
 * Open-source packages shipped in the app (package.json dependencies) and their licenses — checked against
 * node_modules by a test, so a new dependency must be added here.
 */
export const LICENSES: readonly { name: string; license: string }[] = [
  { name: '@expo-google-fonts/inter', license: 'MIT AND OFL-1.1' },
  { name: '@noble/ciphers', license: 'MIT' },
  { name: '@noble/hashes', license: 'MIT' },
  { name: '@react-native-community/datetimepicker', license: 'MIT' },
  { name: '@shopify/flash-list', license: 'MIT' },
  { name: 'drizzle-orm', license: 'Apache-2.0' },
  { name: 'expo', license: 'MIT' },
  { name: 'expo-application', license: 'MIT' },
  { name: 'expo-background-task', license: 'MIT' },
  { name: 'expo-clipboard', license: 'MIT' },
  { name: 'expo-constants', license: 'MIT' },
  { name: 'expo-crypto', license: 'MIT' },
  { name: 'expo-dev-client', license: 'MIT' },
  { name: 'expo-document-picker', license: 'MIT' },
  { name: 'expo-file-system', license: 'MIT' },
  { name: 'expo-font', license: 'MIT' },
  { name: 'expo-haptics', license: 'MIT' },
  { name: 'expo-image', license: 'MIT' },
  { name: 'expo-image-manipulator', license: 'MIT' },
  { name: 'expo-image-picker', license: 'MIT' },
  { name: 'expo-linking', license: 'MIT' },
  { name: 'expo-local-authentication', license: 'MIT' },
  { name: 'expo-localization', license: 'MIT' },
  { name: 'expo-navigation-bar', license: 'MIT' },
  { name: 'expo-notifications', license: 'MIT' },
  { name: 'expo-print', license: 'MIT' },
  { name: 'expo-router', license: 'MIT' },
  { name: 'expo-sharing', license: 'MIT' },
  { name: 'expo-splash-screen', license: 'MIT' },
  { name: 'expo-sqlite', license: 'MIT' },
  { name: 'expo-status-bar', license: 'MIT' },
  { name: 'expo-system-ui', license: 'MIT' },
  { name: 'expo-task-manager', license: 'MIT' },
  { name: 'fflate', license: 'MIT' },
  { name: 'i18next', license: 'MIT' },
  { name: 'lucide-react-native', license: 'ISC' },
  { name: 'react', license: 'MIT' },
  { name: 'react-dom', license: 'MIT' },
  { name: 'react-i18next', license: 'MIT' },
  { name: 'react-native', license: 'MIT' },
  { name: 'react-native-gesture-handler', license: 'MIT' },
  { name: 'react-native-reanimated', license: 'MIT' },
  { name: 'react-native-safe-area-context', license: 'MIT' },
  { name: 'react-native-screens', license: 'MIT' },
  { name: 'react-native-svg', license: 'MIT' },
  { name: 'react-native-worklets', license: 'MIT' },
];

/** Licenses sheet: one group per license, packages A–Z; the Inter typeface is named on its own (SIL OFL 1.1). */
export function licenseGroups(list: readonly { name: string; license: string }[] = LICENSES): { license: string; names: string[] }[] {
  const by = new Map<string, string[]>();
  for (const { name, license } of list) {
    for (const l of license.split(/\s+AND\s+/)) {
      const shown = l === 'OFL-1.1' ? t('system:about.interFont') : name;
      by.set(l, [...(by.get(l) ?? []), shown]);
    }
  }
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([license, names]) => ({ license: licenseName(license), names: names.sort((a, b) => a.localeCompare(b)) }));
}

const LICENSE_NAMES = ['MIT', 'ISC', 'Apache-2.0', 'OFL-1.1'] as const;

/** "MIT" → "MIT License"; an unknown SPDX id is shown as is. */
function licenseName(spdx: string): string {
  return (LICENSE_NAMES as readonly string[]).includes(spdx) ? t(`system:about.licenseName.${spdx as (typeof LICENSE_NAMES)[number]}`) : spdx;
}
