import { Link } from 'expo-router';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { t } from '@/i18n';
import { routes } from '@/routes';

/** Unknown deep link (evenlease://…) — never a blank screen. */
export default function NotFound() {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={[styles.root, { backgroundColor: dark ? '#111315' : '#F7F6F2' }]}>
      <Text style={[styles.title, { color: dark ? '#ECEDEE' : '#1A1C1E' }]}>{t('common:notFound.title')}</Text>
      <Link href={routes.rentals()} replace style={[styles.link, { color: dark ? '#7CC2C9' : '#1F5C63' }]}>
        {t('common:notFound.goHome')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 17, textAlign: 'center' },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 15, padding: 12 },
});
