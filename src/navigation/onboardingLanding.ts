/**
 * B-40: where S-01 lands. Finishing S-01 only flips `onboarded`; the root stack's guard then replaces S-01 with the
 * tabs (RootNavigator). Navigating from S-01 at the same time races that redirect (the settings store updates a beat
 * later): "Explore with a sample rental" ended on S-06 with no tabs under it. So S-01 leaves a landing here and the
 * tabs layout pushes it once it is mounted → stack [(tabs), S-06], Back → Rentals.
 */
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { routes } from '@/routes';

let landing: Href | null = null;

/** Called by S-01 right after finishing: Rentals needs nothing; any other screen is pushed above the tabs. */
export function landAfterOnboarding(next: Href): void {
  landing = next === routes.rentals() ? null : next;
}

/** Called by app/(tabs)/_layout.tsx. */
export function useOnboardingLanding(): void {
  const router = useRouter();
  useEffect(() => {
    const next = landing;
    landing = null;
    if (next) router.push(next);
  }, [router]);
}
