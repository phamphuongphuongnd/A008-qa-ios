import { Tabs } from 'expo-router';
import { BookOpen, House, Settings } from 'lucide-react-native';
import { useColorScheme } from 'react-native';

import { t } from '@/i18n';

// tokens.json accent / text2 / surface / border. TODO(1C merge): colours + tab bar style from @/theme.
const COLORS = {
  light: { active: '#1F5C63', inactive: '#585D62', bar: '#FFFFFF', border: '#DCD7CC' },
  dark: { active: '#7CC2C9', inactive: '#A9B0B5', bar: '#1A1D20', border: '#343A3F' },
};

/** product.md §4: three tabs — Rentals (S-02) · Guide (S-25) · Settings (S-21). Owner: 1A / coordinator. */
export default function TabsLayout() {
  const c = useColorScheme() === 'dark' ? COLORS.dark : COLORS.light;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.active,
        tabBarInactiveTintColor: c.inactive,
        tabBarStyle: { backgroundColor: c.bar, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('common:tabs.rentals'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="guide"
        options={{ title: t('common:tabs.guide'), tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common:tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
