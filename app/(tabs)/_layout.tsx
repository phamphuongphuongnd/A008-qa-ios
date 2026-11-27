import { Tabs } from 'expo-router';
import { BookOpen, House, Settings } from 'lucide-react-native';

import { t } from '@/i18n';
import { useOnboardingLanding } from '@/navigation/onboardingLanding';
import { TabIcon, useTabBarOptions } from '@/ui';

/** product.md §4: three tabs — Rentals (S-02) · Guide (S-25) · Settings (S-21). Owner: 1A / coordinator. */
export default function TabsLayout() {
  // 1D: v2 tab bar (surface-1, 64 high, accent-soft pill behind the active icon).
  const screenOptions = useTabBarOptions();
  // B-40: "Explore with a sample rental" lands on S-06 above the tabs once S-01 has handed over.
  useOnboardingLanding();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: t('common:tabs.rentals'), tabBarIcon: (p) => <TabIcon icon={House} {...p} /> }}
      />
      <Tabs.Screen
        name="guide"
        options={{ title: t('common:tabs.guide'), tabBarIcon: (p) => <TabIcon icon={BookOpen} {...p} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common:tabs.settings'),
          tabBarIcon: (p) => <TabIcon icon={Settings} {...p} />,
        }}
      />
    </Tabs>
  );
}
