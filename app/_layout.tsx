import '@/i18n';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider } from 'expo-router/react-navigation';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db, ensureMigrated, getSetting, useLive } from '@/db';
import { RouterBridge } from '@/services/router';
import { navigationTheme, palettes, ThemeProvider, useTheme } from '@/theme';
import { SnackbarProvider } from '@/ui';

SplashScreen.preventAutoHideAsync();

// Android has Inter linked into the APK at build time (expo-font plugin in app.json) → nothing to load there.
const RUNTIME_FONTS =
  Platform.OS === 'android' ? {} : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

/** Deep links (evenlease://units/1, a timer notification → /review/rental/1/queue) keep the tabs underneath for Back. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Root: fonts + database migrations before the first screen (1C), then the theme from Settings › Appearance (1C) and
 * the root stack — 3 tabs at the bottom, every other screen pushed above them (no tab bar), see docs/ROUTES.md.
 * Plug-in points for later sessions (merged by the coordinator, keep this file small):
 * - 2E: onboarding guard (Stack.Protected on `onboarded`), App lock gate, notification tap → route.
 * - 2B: Applicant mode guard (while active, only `applicants/mode/*` is reachable; see the group below).
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(RUNTIME_FONTS);
  const fontsReady = Platform.OS === 'android' || fontsLoaded || !!fontError;
  const [dbState, setDbState] = useState<'opening' | 'ready' | 'failed'>('opening');

  useEffect(() => {
    ensureMigrated().then(
      () => setDbState('ready'),
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
        <AppTheme>
          <SnackbarProvider>
            <RootStack />
          </SnackbarProvider>
        </AppTheme>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Settings › Appearance (System / Light / Dark), live: changing it re-themes the app at once. */
function AppTheme({ children }: { children: React.ReactNode }) {
  const preference = useLive(() => getSetting(db, 'theme'), [], ['settings']);
  return <ThemeProvider preference={preference}>{children}</ThemeProvider>;
}

function RootStack() {
  const theme = useTheme();
  const bg = theme.colors.bg;
  // Root view behind every screen (keyboard / rotation flashes) follows the theme too.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [bg]);
  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {/* Android 3-button bar: light buttons on a dark scrim in dark theme (otherwise it stays white — A006 fact). */}
      <NavigationBar style={theme.dark ? 'light' : 'dark'} />
      {/* A006 B-23: keeps `router` from @/services/router bound to the live tree after a config change. */}
      <RouterBridge />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
        {/* Sheets: S-07 Add applicant, S-15 Decision. */}
        <Stack.Screen name="applicants/add" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="review/applicant/[id]/decision" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents' }} />
        {/* Applicant mode (S-08a → S-08 → S-08b): full screen, no swipe back; leaving needs the landlord's lock (2B). */}
        <Stack.Screen name="applicants/mode/start/[rentalId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="applicants/mode/form/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="applicants/mode/done/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="dev/gallery" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </NavigationThemeProvider>
  );
}

/** The database could not be opened / migrated (disk full, corrupt file). Nothing else can work. */
function DatabaseError() {
  const c = palettes.light;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: c.bg }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 17, color: c.text, textAlign: 'center' }}>
        Evenlease couldn&apos;t open its data on this phone.
      </Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: c.text2, textAlign: 'center', marginTop: 8 }}>
        Close the app and open it again. If it keeps happening, check that the phone has free storage.
      </Text>
    </View>
  );
}
