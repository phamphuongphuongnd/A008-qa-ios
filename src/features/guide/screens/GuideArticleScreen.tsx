/**
 * S-25a Guide article (v2 design system): title · reading time · paragraphs · Sources (open in the browser) ·
 * "Not legal advice" footer. Unknown slug (old deep link) → empty state.
 */
import { useLocalSearchParams } from 'expo-router';
import { BookX, ExternalLink } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { withLockSuspended } from '@/features/settings/lockController';
import { t } from '@/i18n';
import { font } from '@/theme';
import { AppBar, EmptyState, LegalFooter, ListGroup, ListRow, Screen, SectionHeader, Txt } from '@/ui';

import { getArticle } from '../articles';

export default function GuideArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const a = getArticle(String(slug ?? ''));
  if (!a) {
    return (
      <Screen header={<AppBar title={t('guide:s25a.title')} />}>
        <EmptyState icon={BookX} title={t('guide:s25a.notFound')} />
      </Screen>
    );
  }
  return (
    <Screen header={<AppBar title={t('guide:s25.title')} />}>
      <View style={{ gap: 6 }}>
        <Txt accessibilityRole="header" style={font(700, 26, 32, -0.02)}>
          {a.title}
        </Txt>
        <Txt color="inkMuted" variant="caption">
          {t('guide:s25.minutes', { count: a.minutes })}
        </Txt>
      </View>
      {a.body.map((p, i) => (
        <Txt key={i} style={font(400, 16, 24)}>
          {p}
        </Txt>
      ))}
      <View style={{ gap: 16 }}>
        <SectionHeader title={t('guide:s25a.sources')} />
        <ListGroup>
          {a.sources.map((s) => (
            <ListRow
              key={s.url}
              title={s.label}
              icon={ExternalLink}
              accessibilityHint={t('guide:s25a.opensBrowser')}
              onPress={() => withLockSuspended(() => Linking.openURL(s.url))}
            />
          ))}
        </ListGroup>
      </View>
      <LegalFooter />
    </Screen>
  );
}
