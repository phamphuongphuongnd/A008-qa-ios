import '@/i18n';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { backupActions } from '@/backup';
import { registerBackupTask } from '@/backup/backgroundTask';
import { db, ensureMigrated } from '@/db';
import { excludeAppDataFromBackup } from '@/files/cloudBackup';
import { cloudBackupPort } from '@/files/cloudBackupNative';
import { useApplicantModeGuard } from '@/features/intake/applicantMode/hooks';
import { settingsPersistence } from '@/features/intake/applicantMode/persistence';
import { hydrateApplicantMode, useApplicantMode } from '@/features/intake/applicantMode/store';
import { isActive as applicantModeOn } from '@/features/intake/applicantMode/machine';
import { LockScreen, LockShield } from '@/features/settings/components/LockScreen';
import { useAppLockGate, useOnboarded } from '@/features/settings/hooks';
import { isLockVisible } from '@/features/settings/lock';
import { ROOT_STACK_SETTINGS, RootNavigator } from '@/navigation/RootNavigator';
import { useNotificationSetup } from '@/notifications';
import { ExactAlarmPromptHost } from '@/notifications/ExactAlarmPromptHost';
import { RouterBridge } from '@/services/router';
import { useTheme } from '@/theme';
import { AppThemeProvider, SystemBars } from '@/theme/preference';
import { SnackbarHost } from '@/ui';

SplashScreen.preventAutoHideAsync();

// Android has Inter linked into the APK at build time (expo-font plugin in app.json) → nothing to load there.
const RUNTIME_FONTS =
  Platform.OS === 'android' ? {} : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

/** Deep links (evenlease://units/1, a timer notification → /review/rental/1/queue) keep the tabs underneath for Back. */
export const unstable_settings = ROOT_STACK_SETTINGS;

/**
 * Root stack: the 3 tabs at the bottom, every other screen pushed above them (no tab bar), see docs/ROUTES.md.
 * Plug-in points for later sessions (merged by the coordinator, keep this file small):
 * - 1C: database migrations run before the first screen (below).
 * - 1D: AppThemeProvider (settings.theme; Settings › Appearance calls setThemePreference from '@/theme/preference'),
 *   system bars, SnackbarHost (showSnackbar from '@/ui').
 * - 2E: onboarding guard (Stack.Protected on `onboarded`, in RootNavigator), App lock gate (LockScreen over the stack), notification
 *   channels + tap → `data.url`, automatic backup when due + background task registration (index.ts defines it).
 * - 2B: Applicant mode restored from settings after migrations; guard keeps the router inside `applicants/mode/*`.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(RUNTIME_FONTS);
  const fontsReady = Platform.OS === 'android' || fontsLoaded || !!fontError;
  // 1C: every screen reads SQLite synchronously, so the bundled migrations finish before the first one renders.
  const [dbState, setDbState] = useState<'opening' | 'ready' | 'failed'>('opening');

  useEffect(() => {
    ensureMigrated().then(
      () => {
        // G-05 (iOS): applicant files + the database stay out of iCloud / computer backups (no-op on Android).
        excludeAppDataFromBackup(cloudBackupPort);
        // 2B: a session that was on when the app closed comes back (the applicant never lands in the landlord's data).
        hydrateApplicantMode(settingsPersistence(db));
        setDbState('ready');
      },
      () => setDbState('failed'),
    );
  }, []);

  useEffect(() => {
    if (fontsReady && dbState !== 'opening') SplashScreen.hideAsync();
  }, [fontsReady, dbState]);

  if (!fontsReady || dbState === 'opening') return null;
  if (dbState === 'failed') return <DatabaseError />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* 1D: theme from settings.theme (Settings › Appearance) + status / navigation bar colours. */}
        <AppThemeProvider>
          <RootStack />
          <SnackbarHost />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The stack, themed (v2 Indigo surface-0 behind every screen and transition). */
function RootStack() {
  const { dark, colors } = useTheme();
  // 2E: S-01 until finished (onboarded + "Not legal advice" accepted); S-27 "Delete everything" turns it back off.
  const onboarded = useOnboarded();
  const lock = useAppLockGate();
  const [applicantMode] = useApplicantMode();
  const lockShown = isLockVisible(onboarded, lock.locked, applicantModeOn(applicantMode));
  useEffect(() => {
    if (!onboarded) return;
    registerBackupTask();
    backupActions.runAutoIfDue().catch(() => {});
  }, [onboarded]);
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.surface0,
      card: colors.surface1,
      text: colors.ink,
      border: colors.line,
      notification: colors.danger,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      {/* A006 B-23: keeps `router` from @/services/router bound to the live tree after a config change. */}
      <RouterBridge />
      <ApplicantModeGuard />
      {/* Tabs + every pushed screen; onboarding gate (B-40) inside, see src/navigation/RootNavigator.tsx.
          B-70: while the lock is up, screen readers can't reach the screens behind it. */}
      <LockShield hidden={lockShown}>
        <RootNavigator onboarded={onboarded} contentStyle={{ backgroundColor: colors.surface0 }} />
      </LockShield>
      <NotificationSetup />
      {/* B-151: "Get deadline reminders on time?" in the app's own dialog (asked from non-screen code). */}
      <ExactAlarmPromptHost />
      {/* 2E App lock; the applicant holding the phone (Applicant mode) never sees it — 2B has its own exit lock. */}
      {lockShown ? <LockScreen pinBlockedUntil={lock.pinBlockedUntil} /> : null}
    </ThemeProvider>
  );
}

/** 2B: while Applicant mode is on, any other path is sent back to the session's screen; Android Back swallowed. */
function ApplicantModeGuard() {
  useApplicantModeGuard();
  return null;
}

/** 2E: notification channels, reminders sync, tap → route (needs the router, so inside the stack's tree). */
function NotificationSetup() {
  useNotificationSetup();
  return null;
}

/** The database could not be opened / migrated (disk full, corrupt file): nothing else can work. */
function DatabaseError() {
  // No database → no stored theme: follows the phone.
  const { colors, type } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.surface0 }}>
      <SystemBars />
      <Text style={[type.title2, { color: colors.ink, textAlign: 'center' }]}>
        Evenlease couldn&apos;t open its data on this phone.
      </Text>
      <Text style={[type.callout, { color: colors.inkMuted, textAlign: 'center', marginTop: 8 }]}>
        Close the app and open it again. If it keeps happening, check that the phone has free storage.
      </Text>
    </View>
  );
}
