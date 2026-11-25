import { Link, useGlobalSearchParams, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';

import { SCREEN_IDS, SCREENS, type ScreenId } from './screens';

// tokens.json bg / text / text2 / accent. TODO(1C): use @/theme once it exists.
const COLORS = {
  light: { bg: '#F7F6F2', text: '#1A1C1E', text2: '#585D62', accent: '#1F5C63' },
  dark: { bg: '#111315', text: '#ECEDEE', text2: '#A9B0B5', accent: '#7CC2C9' },
};

/**
 * Empty screen used by every route until its Phase 2 session builds it: "S-xx <title>", the path + params it was opened
 * with, and (dev builds) a jump list to every other screen so the skeleton can be walked through on a device.
 */
export function ScreenPlaceholder({ id, note }: { id: ScreenId; note?: string }) {
  const c = useColorScheme() === 'dark' ? COLORS.dark : COLORS.light;
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
          {`${id} ${SCREENS[id].title()}`}
        </Text>
        <Text style={[styles.meta, { color: c.text2 }]}>{pathname}</Text>
        {Object.keys(params).length > 0 ? (
          <Text style={[styles.meta, { color: c.text2 }]}>{JSON.stringify(params)}</Text>
        ) : null}
        {note ? <Text style={[styles.meta, { color: c.text2 }]}>{note}</Text> : null}
        <Text style={[styles.meta, { color: c.text2 }]}>{t('common:placeholder.note')}</Text>
        {__DEV__ ? (
          <View style={styles.jump}>
            {SCREEN_IDS.filter((s) => s !== id).map((s) => (
              <Link key={s} href={SCREENS[s].sample} style={[styles.link, { color: c.accent }]}>
                {`${s} ${SCREENS[s].title()}`}
              </Link>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 24, gap: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  jump: { marginTop: 16 },
  link: { fontFamily: 'Inter_500Medium', fontSize: 15, paddingVertical: 12 },
});
