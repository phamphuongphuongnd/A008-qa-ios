import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, useTheme } from '@/theme';

import type { IconComponent } from './Button';

/** Tab icon inside the 56×30 pill (accent-soft behind the active tab — mockup Components › Tab Bar). */
export function TabIcon({ icon: Icon, focused, color }: { icon: IconComponent; focused: boolean; color: ColorValue }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 56,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accentSoft : 'transparent',
      }}
    >
      <Icon color={String(color)} size={22} strokeWidth={focused ? 2 : 1.8} />
    </View>
  );
}

/**
 * Tabs `screenOptions` for the v2 tab bar: surface-1, top line, 64 high + bottom safe area, muted / accent labels.
 * `<Tabs screenOptions={useTabBarOptions()}>` and per tab `tabBarIcon: (p) => <TabIcon icon={House} {...p} />`.
 */
export function useTabBarOptions() {
  const { colors, size } = useTheme();
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.inkMuted,
    tabBarStyle: {
      backgroundColor: colors.surface1,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      height: size.tabbarH + insets.bottom,
      paddingBottom: insets.bottom,
      elevation: 0,
    },
    tabBarItemStyle: { paddingTop: 8, paddingBottom: 6, gap: 3 },
    tabBarLabelStyle: { ...font(500, 12, 16) },
    tabBarAllowFontScaling: true,
  } as const;
}
