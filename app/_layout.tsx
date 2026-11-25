import '@/i18n';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ensureMigrated } from '@/db';
import { RouterBridge } from '@/services/router';

SplashScreen.preventAutoHideAsync();

// Android has Inter linked into the APK at build time (expo-font plugin in app.json) → nothing to load there.
const RUNTIME_FONTS =
  Platform.OS === 'android' ? {} : { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

// design/tokens.json color.*.bg. TODO(1C merge): theme provider from @/theme (Settings › Appearance).
const BG = { light: '#F7F6F2', dark: '#111315' };

/** Deep links (evenlease://units/1, a timer notification → /review/rental/1/queue) keep the tabs underneath for Back. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Root stack: the 3 tabs at the bottom, every other screen pushed above them (no tab bar), see docs/ROUTES.md.
 * Plug-in points for later sessions (merged by the coordinator, keep this file small):
 * - 1C: database migrations run before the first screen (below). Theme provider + snackbar host wait for the new mockup.
 * - 2E: onboarding guard (Stack.Protected on `onboarded`), App lock gate, theme setting, notification tap → route.
 * - 2B: Applicant mode guard (while active, only `applicants/mode/*` is reachable; see the group below).
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(RUNTIME_FONTS);
  const fontsReady = Platform.OS === 'android' || fontsLoaded || !!fontError;
  const dark = useColorScheme() === 'dark';
  // 1C: every screen reads SQLite synchronously, so the bundled migrations finish before the first one renders.
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
  if (dbState === 'failed') return <DatabaseError dark={dark} />;

  const bg = dark ? BG.dark : BG.light;
  const navTheme = dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: bg } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: bg } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          {/* A006 B-23: keeps `router` from @/services/router bound to the live tree after a config change. */}
          <RouterBridge />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
            {/* Sheets: S-07 Add applicant, S-15 Decision. */}
            <Stack.Screen name="applicants/add" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents' }} />
            <Stack.Screen
              name="review/applicant/[id]/decision"
              options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents' }}
            />
            {/* Applicant mode (S-08a → S-08 → S-08b): full screen, no swipe back; leaving needs the landlord's lock (2B). */}
            <Stack.Screen name="applicants/mode/start/[rentalId]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="applicants/mode/form/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="applicants/mode/done/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="dev/gallery" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The database could not be opened / migrated (disk full, corrupt file): nothing else can work. */
function DatabaseError({ dark }: { dark: boolean }) {
  const c = dark ? { bg: BG.dark, text: '#ECEDEE', text2: '#A9B0B5' } : { bg: BG.light, text: '#1A1C1E', text2: '#585D62' };
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
