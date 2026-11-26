import fs from 'fs';
import path from 'path';

import { SCREEN_IDS, SCREENS } from '../screens';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });
}

/** product.md §5: S-01…S-27 plus S-08a/S-08b, the Guide article screen and S-21 About (mockup v2). */
const EXPECTED = [
  ...Array.from({ length: 27 }, (_, i) => `S-${String(i + 1).padStart(2, '0')}`),
  'S-08a',
  'S-08b',
  'S-21a',
  'S-25a',
].sort();

describe('screen table', () => {
  it('has every screen of product.md §5', () => {
    expect([...SCREEN_IDS].sort()).toEqual(EXPECTED);
  });

  it.each(SCREEN_IDS)('%s: screen file exists and every route file is a thin shell importing it', (id) => {
    const info = SCREENS[id];
    // The screen file default-exports the component the route shells re-export.
    expect(read(info.screen)).toMatch(/export default function|export default /);
    const module = info.screen.replace(/^src\//, '@/').replace(/\.tsx$/, '');
    for (const route of info.routes) expect(read(route)).toContain(`'${module}'`);
    expect(info.title()).not.toMatch(/^s\d|:/); // translated, not a raw key
  });

  it('lists every route file under app/ (besides layouts, not-found and the 1C gallery)', () => {
    const declared = new Set<string>(SCREEN_IDS.flatMap((id) => [...SCREENS[id].routes]));
    const files = walk('app').filter(
      (f) => !/\/_layout\.tsx$/.test(f) && f !== 'app/+not-found.tsx' && f !== 'app/dev/gallery.tsx',
    );
    expect(files.filter((f) => !declared.has(f))).toEqual([]);
    expect([...declared].filter((f) => !files.includes(f))).toEqual([]);
  });

  it('has a distinct sample link per screen', () => {
    const hrefs = SCREEN_IDS.map((id) => String(SCREENS[id].sample));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
