/**
 * The root stack of app/_layout.tsx: the 3 tabs at the bottom, every other screen pushed above them (docs/ROUTES.md).
 * Kept apart from the layout (which loads fonts, the database, theme…) so the navigation tests render this exact stack.
 *
 * B-40 — onboarding gate. expo-router 58 keeps a guarded screen registered and renders a `<Redirect>` in its place.
 * Without `redirectTo` it falls back to the first unguarded route it finds (`units/new` → a fresh install opened
 * S-03). So each `Stack.Protected` names where to go:
 * - not onboarded: anything under the tabs → S-01 (fresh install, `pm clear`, after S-27 Delete all);
 * - onboarded: S-01 → Rentals (finishing S-01 needs no navigation of its own; see `landAfterOnboarding`).
 */
import { Stack } from 'expo-router';
import type { ViewStyle } from 'react-native';

import { routes } from '@/routes';

/** `anchor` (was the deprecated `initialRouteName`): a deep link keeps the tabs underneath for Back. */
export const ROOT_STACK_SETTINGS = { anchor: '(tabs)' } as const;

export function RootNavigator({ onboarded, contentStyle }: { onboarded: boolean; contentStyle?: ViewStyle }) {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle }}>
      <Stack.Protected guard={onboarded} redirectTo={routes.onboarding()}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!onboarded} redirectTo={routes.rentals()}>
        <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
      </Stack.Protected>
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
  );
}
