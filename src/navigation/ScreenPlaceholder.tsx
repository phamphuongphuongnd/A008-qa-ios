import { Link, useGlobalSearchParams, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { SCREEN_IDS, SCREENS, type ScreenId } from './screens';

/**
 * Empty screen used by every route until its Phase 2 session builds it: "S-xx <title>", the path + params it was opened
 * with, and (dev builds) a jump list to every other screen so the skeleton can be walked through on a device.
 */
export function ScreenPlaceholder({ id, note }: { id: ScreenId; note?: string }) {
  // 1D: v2 theme colours.
  const { colors } = useTheme();
  const c = { bg: colors.surface0, text: colors.ink, text2: colors.inkMuted, accent: colors.accent };
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
