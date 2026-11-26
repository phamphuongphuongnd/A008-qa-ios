import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palettes, radius, shadows, size, space, type, type Palette, type Scheme, type Shadows } from './tokens';

/** Settings › Appearance (S-21). 'system' follows the phone. Stored in settings.theme (src/db/repos/settings.ts). */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  dark: boolean;
  colors: Palette;
  shadows: Shadows;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  size: typeof size;
}

export function themeFor(scheme: Scheme): Theme {
  return { scheme, dark: scheme === 'dark', colors: palettes[scheme], shadows: shadows[scheme], type, space, radius, size };
}

export const THEMES: Record<Scheme, Theme> = { light: themeFor('light'), dark: themeFor('dark') };

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

const ThemeCtx = createContext<Theme | null>(null);

/**
 * Light / dark from the phone, or forced by `preference`. The app root uses `AppThemeProvider` (preference from the
 * database); nest one with `preference="dark"` to force a subtree (the gallery shows both themes this way).
 */
export function ThemeProvider({ preference = 'system', children }: { preference?: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system);
  const value = useMemo(() => THEMES[scheme], [scheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Current theme. Outside a provider (tests, the database-error screen) it follows the phone. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  const system = useColorScheme();
  return ctx ?? THEMES[system === 'dark' ? 'dark' : 'light'];
}

/** '#4f46e5' + 0.12 → 'rgba(79,70,229,0.12)'. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
