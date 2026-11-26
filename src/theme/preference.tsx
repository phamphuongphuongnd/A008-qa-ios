import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { db, getSetting, markTablesChanged, updateSettings, useLive } from '@/db';

import { ThemeProvider, useTheme, type ThemePreference } from './ThemeProvider';

/**
 * Theme preference stored in the database (settings.theme). Kept out of `@/theme`'s index because importing `@/db`
 * opens SQLite — Jest tests of the UI kit import `@/theme` without it. Import from '@/theme/preference'.
 */

/** Settings › Appearance (S-21) value; re-renders when it changes. Call only after `ensureMigrated()`. */
export function useThemePreference(): ThemePreference {
  return useLive(() => getSetting(db, 'theme'), [], ['settings']);
}

/** Settings › Appearance: 'system' | 'light' | 'dark'. The whole app re-themes at once. */
export function setThemePreference(preference: ThemePreference): void {
  updateSettings(db, { theme: preference });
  markTablesChanged(['settings']);
}

/** App root: the stored preference → ThemeProvider, plus status bar / Android navigation bar / window colour. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemePreference();
  return (
    <ThemeProvider preference={preference}>
      <SystemBars />
      {children}
    </ThemeProvider>
  );
}

/**
 * System bars follow the app theme, not the phone (a forced Dark on a light phone). The Android navigation bar is
 * transparent (app.json expo-navigation-bar enforceContrast: false) so the screen colour shows through; only its
 * buttons switch dark / light here. The window colour stops a white flash behind screen transitions and the keyboard.
 */
export function SystemBars() {
  const { dark, colors } = useTheme();
  useEffect(() => {
    if (Platform.OS === 'android') NavigationBar.setStyle(dark ? 'light' : 'dark');
    SystemUI.setBackgroundColorAsync(colors.surface0).catch(() => {});
  }, [dark, colors.surface0]);
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}
