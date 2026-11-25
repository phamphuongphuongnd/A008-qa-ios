import tokens from '../../../design/tokens.json';
import { palettes } from '../tokens';
import { shade } from '../ThemeProvider';
import { layoutInfoFor } from '../layoutInfo';

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('tokens', () => {
  it('match design/tokens.json exactly', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [k, v] of Object.entries(tokens.color[scheme])) expect([scheme, k, palettes[scheme][k as keyof (typeof palettes)['light']]]).toEqual([scheme, k, v]);
    }
  });

  it('status colours reach WCAG AA (4.5:1) on their backgrounds in both themes', () => {
    for (const c of [palettes.light, palettes.dark]) {
      const pairs: [string, string][] = [
        [c.text, c.bg],
        [c.text2, c.bg],
        [c.text2, c.surface],
        [c.accent, c.accentSoft],
        [c.danger, c.dangerSoft],
        [c.warning, c.warningSoft],
        [c.missing, c.surface],
        [c.onAccent, c.accent],
        [c.onDanger, c.danger],
        [c.accent, c.surface],
      ];
      for (const [fg, bg] of pairs) expect([fg, bg, contrast(fg, bg) >= 4.5]).toEqual([fg, bg, true]);
    }
  });

  it('shade darkens a colour', () => {
    expect(shade('#FFFFFF', 0.88)).toBe('#E0E0E0');
    expect(shade('#1F5C63', 1)).toBe('#1F5C63');
  });

  it('layout rules: tablet column 600, compare stacks from 130% text', () => {
    expect(layoutInfoFor(800, 1).contentWidth).toBe(600);
    expect(layoutInfoFor(390, 1.3).stackTables).toBe(true);
    expect(layoutInfoFor(390, 1.29).stackTables).toBe(false);
    expect(layoutInfoFor(320, 2).stackRows).toBe(true);
  });
});
