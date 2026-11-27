// Thin route shell (1A): the screen lives in src/features/onboarding/; once onboarded it leaves to the tabs (B-40).
import OnboardingScreen from '@/features/onboarding/screens/OnboardingScreen';
import { OnboardingRoute } from '@/navigation/RootNavigator';

export default function Onboarding() {
  return (
    <OnboardingRoute>
      <OnboardingScreen />
    </OnboardingRoute>
  );
}
