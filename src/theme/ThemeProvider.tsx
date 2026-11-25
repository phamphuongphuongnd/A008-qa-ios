import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, shadows, type Palette, type Scheme } from './tokens';

/** Settings › Appearance (S-21). 'system' follows the phone. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  dark: boolean;
  colors: Palette;
  shadows: (typeof shadows)[Scheme];
}

export function themeFor(scheme: Scheme): Theme {
  return { scheme, dark: scheme === 'dark', colors: palettes[scheme], shadows: shadows[scheme] };
}

const THEMES: Record<Scheme, Theme> = { light: themeFor('light'), dark: themeFor('dark') };

const ThemeCtx = createContext<Theme | null>(null);

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * Light / dark from the phone, or forced by Settings › Appearance (`preference`). Nest one with `preference="dark"` to
 * force a subtree (the gallery does this to show both themes side by side).
 */
export function ThemeProvider({ preference = 'system', children }: { preference?: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system);
  const value = useMemo(() => THEMES[scheme], [scheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Current theme. Outside a provider (tests, early boot) it follows the phone. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  const system = useColorScheme();
  return ctx ?? THEMES[system === 'dark' ? 'dark' : 'light'];
}

function rgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** '#1F5C63' + 0.12 → 'rgba(31,92,99,0.12)'. State layers of a label colour. */
export function withAlpha(hex: string, alpha: number): string {
  const c = rgb(hex);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})` : hex;
}

/** Multiplies each channel (mockup "Pressed" = CSS `filter: brightness(.88)`). */
export function shade(hex: string, factor: number): string {
  const c = rgb(hex);
  if (!c) return hex;
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`.toUpperCase();
}
