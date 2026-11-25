import { DarkTheme, DefaultTheme } from 'expo-router/react-navigation';

import { fonts } from './tokens';
import type { Theme } from './ThemeProvider';

/** React Navigation theme (screen background, tab bar, header defaults) from the app theme. */
export function navigationTheme(theme: Theme) {
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const c = theme.colors;
  return {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.surface, text: c.text, border: c.border, notification: c.danger },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: '400' as const },
      medium: { fontFamily: fonts.medium, fontWeight: '500' as const },
      bold: { fontFamily: fonts.semibold, fontWeight: '600' as const },
      heavy: { fontFamily: fonts.bold, fontWeight: '700' as const },
    },
  };
}
