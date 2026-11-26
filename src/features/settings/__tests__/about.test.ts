import fs from 'fs';
import path from 'path';

import { FEEDBACK_EMAIL, LICENSES, aboutLine, appVersion, feedbackMailto, licenseGroups, versionLabel } from '../about';

const ROOT = path.resolve(__dirname, '../../../..');
const json = (rel: string) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('S-21 About', () => {
  it('version from app config + native build number: "Version 1.0 (1)"', () => {
    const android = appVersion({ expoConfig: { version: '1.0.0' }, platform: { android: { versionCode: 1 } } });
    expect(android).toEqual({ version: '1.0', build: '1' });
    expect(versionLabel(android)).toBe('Version 1.0 (1)');
    expect(aboutLine(android)).toBe('Version 1.0 (1) · No account · No servers');
    expect(versionLabel(appVersion({ expoConfig: { version: '1.2.3' }, platform: { ios: { buildNumber: '14' } } }))).toBe('Version 1.2.3 (14)');
    // Expo Go / tests: no native build number.
    expect(versionLabel(appVersion({ expoConfig: { version: '1.0.0' }, platform: { ios: { buildNumber: null } } }))).toBe('Version 1.0');
    expect(versionLabel(appVersion({}))).toBeNull();
    expect(aboutLine(appVersion({}))).toBe('No account · No servers');
  });

  it('app.json version is what the About line reads', () => {
    expect(appVersion({ expoConfig: { version: json('app.json').expo.version } }).version).toBe('1.0');
  });

  it('"Send feedback" is hidden in 1.0 (no support email yet), mailto once one is set', () => {
    expect(FEEDBACK_EMAIL).toBe('');
    expect(feedbackMailto()).toBeNull();
    expect(feedbackMailto('  ')).toBeNull();
    expect(feedbackMailto('help@example.com')).toBe('mailto:help@example.com?subject=Evenlease%20feedback');
  });

  it('licenses: every runtime dependency, with the license its package declares', () => {
    const deps = Object.keys(json('package.json').dependencies).sort();
    expect(LICENSES.map((l) => l.name).sort()).toEqual(deps);
    for (const l of LICENSES) expect(`${l.name}: ${json(`node_modules/${l.name}/package.json`).license}`).toBe(`${l.name}: ${l.license}`);
  });

  it('licenses sheet groups by license, MIT first, Inter typeface under the OFL', () => {
    const groups = licenseGroups();
    expect(groups[0].license).toBe('MIT License');
    expect(groups.find((g) => g.license === 'SIL Open Font License 1.1')?.names).toEqual(['Inter typeface']);
    expect(groups.find((g) => g.license === 'Apache License 2.0')?.names).toEqual(['drizzle-orm']);
    expect(groups.flatMap((g) => g.names)).toContain('@expo-google-fonts/inter');
  });
});
