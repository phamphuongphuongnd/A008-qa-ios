/**
 * The root stack of app/_layout.tsx: the 3 tabs at the bottom, every other screen pushed above them (docs/ROUTES.md).
 * Kept apart from the layout (which loads fonts, the database, theme…) so the navigation tests render this exact stack.
 *
 * Onboarding gate (B-40). expo-router 58 keeps a guarded screen registered and renders a `<Redirect>` in its place;
 * without `redirectTo` it falls back to the first unguarded route it finds (`units/new` → a fresh install opened S-03).
 * - Not onboarded: the tabs AND every landlord screen (GATED_SCREENS) → S-01 — a deep link (`evenlease://units/1`) or a
 *   notification can't go round S-01 and its required "Not legal advice" tick. Only S-01, Applicant mode and
 *   +not-found stay open.
 * - Onboarded: S-01 leaves itself (`OnboardingRoute`) with `dismissTo('/')`: back down to the tabs already in the stack
 *   (a deep link `evenlease://onboarding` → one Rentals, not two), or the tabs in S-01's place (S-01 just finished).
 */
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { createContext, use, useCallback, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { routes } from '@/routes';

/** `anchor` (was the deprecated `initialRouteName`): a deep link keeps the tabs underneath for Back. */
export const ROOT_STACK_SETTINGS = { anchor: '(tabs)' } as const;

/**
 * Every root-stack route (app/ folder) behind the onboarding gate, besides the tabs and the two sheets below.
 * `onboardingGate.test.tsx` fails when a route file under app/ is in neither this list nor UNGATED_ROUTES.
 */
export const GATED_SCREENS = [
  'units/new',
  'units/[id]/index',
  'units/[id]/edit',
  'units/[id]/criteria',
  'units/[id]/published',
  'applicants/[id]/form',
  'applicants/[id]/documents',
  'review/applicant/[id]/index',
  'review/applicant/[id]/letter',
  'review/rental/[id]/queue',
  'review/rental/[id]/compare',
  'review/rental/[id]/decision-file',
  'verify/[applicantId]/background',
  'verify/[applicantId]/employer/[incomeId]',
  'verify/[applicantId]/landlord/[residenceId]',
  'verify/[applicantId]/report',
  'move-in/[rentalId]',
  'guide/[slug]',
  'settings/about',
  'settings/app-lock',
  'settings/backup',
  'settings/cleanup',
  'settings/delete-all',
  'settings/legal',
  'dev/gallery',
] as const;

/** Sheets: S-07 Add applicant, S-15 Decision. */
const SHEETS = ['applicants/add', 'review/applicant/[id]/decision'] as const;

/** Applicant mode (S-08a → S-08 → S-08b): full screen, no swipe back; leaving needs the landlord's lock (2B). */
const APPLICANT_MODE = ['applicants/mode/start/[rentalId]', 'applicants/mode/form/[id]', 'applicants/mode/done/[id]'] as const;

/** Root routes that stay open before onboarding (besides the tabs, gated above). */
export const UNGATED_ROUTES = ['onboarding/index', ...APPLICANT_MODE, '+not-found'] as const;

const OnboardedContext = createContext(false);

export function RootNavigator({ onboarded, contentStyle }: { onboarded: boolean; contentStyle?: ViewStyle }) {
  return (
    <OnboardedContext value={onboarded}>
      <Stack screenOptions={{ headerShown: false, contentStyle }}>
        <Stack.Protected guard={onboarded} redirectTo={routes.onboarding()}>
          <Stack.Screen name="(tabs)" />
          {SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents' }} />
          ))}
          {GATED_SCREENS.map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
        <Stack.Screen name="onboarding/index" options={{ gestureEnabled: false }} />
        {APPLICANT_MODE.map((name) => (
          <Stack.Screen key={name} name={name} options={{ gestureEnabled: false }} />
        ))}
        <Stack.Screen name="+not-found" />
      </Stack>
    </OnboardedContext>
  );
}

/** app/onboarding/index.tsx: S-01 until onboarded, then back to the tabs (see the header). */
export function OnboardingRoute({ children }: { children: ReactNode }) {
  return use(OnboardedContext) ? <LeaveOnboarding /> : children;
}

function LeaveOnboarding() {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      router.dismissTo(routes.rentals());
    }, [router]),
  );
  return null;
}
