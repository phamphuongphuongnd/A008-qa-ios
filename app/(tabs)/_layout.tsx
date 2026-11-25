import { Tabs } from 'expo-router';
import { BookOpen, House, Settings } from 'lucide-react-native';

import { t } from '@/i18n';
import { fonts, useTheme } from '@/theme';

/** product.md §4: three tabs — Rentals (S-02) · Guide (S-25) · Settings (S-21). Owner: 1A / coordinator. */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text2,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
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
