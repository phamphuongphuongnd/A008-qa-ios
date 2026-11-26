import raw from '../../../design/v2-indigo/design-tokens.json';
import { contrastRatio } from '../contrast';
import { resolveScheme, THEMES, withAlpha } from '../ThemeProvider';
import { COLOR_NAMES, interFamily, palettes, radius, shadows, size, space, type, type Palette, type Scheme } from '../tokens';

describe('tokens come from design-tokens.json', () => {
  it('has every colour token of the JSON, both themes, unchanged', () => {
    expect(raw.color.tokens.map((t) => t.name).sort()).toEqual([...COLOR_NAMES].sort());
    for (const t of raw.color.tokens) {
      const key = t.name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof Palette;
      expect(palettes.light[key]).toBe(t.value.light);
      expect(palettes.dark[key]).toBe(t.value.dark);
    }
  });

  it('reads type, spacing, radius, size and shadow', () => {
    expect(type.display).toMatchObject({ fontSize: 28, lineHeight: 34, fontFamily: 'Inter_700Bold' });
    expect(type.display.letterSpacing).toBeCloseTo(-0.56);
    expect(type.title1).toMatchObject({ fontSize: 22, lineHeight: 28, fontFamily: 'Inter_600SemiBold' });
    expect(type.badge).toMatchObject({ fontSize: 12, lineHeight: 16, fontFamily: 'Inter_600SemiBold' });
    expect(type.figure.fontVariant).toEqual(['tabular-nums']);
    expect(space).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 });
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16, xl: 24, pill: 999 });
    expect(size).toEqual({ touchMin: 48, buttonPrimaryH: 52, buttonSecondaryH: 48, tabbarH: 64, contentMax: 600 });
    expect(shadows.dark.card).toBeUndefined();
    expect(shadows.light.card).toContain('rgba(22, 26, 43');
  });

  it('maps weights to the four linked Inter files', () => {
    expect([400, 500, 600, 650, 700].map(interFamily)).toEqual([
      'Inter_400Regular',
      'Inter_500Medium',
      'Inter_600SemiBold',
      'Inter_600SemiBold',
      'Inter_700Bold',
    ]);
  });
});

describe('theme', () => {
  it('follows the phone unless forced', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(THEMES.dark.colors.accent).toBe('#a5b4fc');
  });

  it('withAlpha', () => {
    expect(withAlpha('#4f46e5', 0.12)).toBe('rgba(79,70,229,0.12)');
  });
});

/** WCAG AA: 4.5:1 for text, 3:1 for control edges / focus ring / large text (product.md §9, design-tokens usage). */
describe.each<Scheme>(['light', 'dark'])('contrast AA — %s', (scheme) => {
  const c = palettes[scheme];
  const text: [string, keyof Palette, keyof Palette][] = [
    ['body text on background', 'ink', 'surface0'],
    ['body text on cards', 'ink', 'surface1'],
    ['body text on inputs', 'ink', 'surface2'],
    ['secondary text on background', 'inkMuted', 'surface0'],
    ['secondary text on cards', 'inkMuted', 'surface1'],
    ['Missing badge / secondary on inputs', 'inkMuted', 'surface2'],
    ['links / secondary button', 'accent', 'surface1'],
    ['links on background', 'accent', 'surface0'],
    ['Met badge, selected option', 'accent', 'accentSoft'],
    ['primary button label', 'onAccent', 'accent'],
    ['primary button pressed', 'onAccent', 'accentPressed'],
    ['Needs review / Mismatch badge', 'warn', 'warnSoft'],
    ['warn text on cards', 'warn', 'surface1'],
    ['Not met badge', 'danger', 'dangerSoft'],
    ['danger text / outline button', 'danger', 'surface1'],
    ['destructive button label', 'onDanger', 'danger'],
    ['text on warn banner', 'ink', 'warnSoft'],
    ['text on accent banner', 'ink', 'accentSoft'],
    ['snackbar', 'surface0', 'ink'],
    ['disabled button label', 'inkMuted', 'surface2'],
  ];
  it.each(text)('%s ≥ 4.5', (_, fg, bg) => {
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5);
  });

  const edges: [string, keyof Palette, keyof Palette][] = [
    ['input / toggle-off border on cards', 'lineStrong', 'surface1'],
    ['input border on background', 'lineStrong', 'surface0'],
    ['focus ring on cards', 'focus', 'surface1'],
    ['focus ring on background', 'focus', 'surface0'],
    ['toggle on (accent) against background', 'accent', 'surface0'],
  ];
  it.each(edges)('%s ≥ 3', (_, fg, bg) => {
    expect(contrastRatio(c[fg], c[bg])).toBeGreaterThanOrEqual(3);
  });
});
