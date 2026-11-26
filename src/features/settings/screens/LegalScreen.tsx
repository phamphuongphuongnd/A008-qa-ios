/**
 * S-26 Legal & privacy (product.md S-26; not in the mockup → v2 design system): not a law firm · your data · sources.
 */
import { ExternalLink } from 'lucide-react-native';
import { Linking, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar, Card, LegalFooter, ListGroup, ListRow, Screen, SectionHeader, Txt } from '@/ui';

import { withLockSuspended } from '../lockController';
import { LEGAL_SOURCES } from '../view';

export default function LegalScreen() {
  return (
    <Screen header={<AppBar title={t('system:s26.title')} />}>
      <Card>
        <Txt>{t('system:s26.notLawFirm')}</Txt>
        <Txt color="inkMuted">{t('system:s26.sameCriteria')}</Txt>
      </Card>
      <View style={{ gap: 16 }}>
        <SectionHeader title={t('system:s26.dataTitle')} />
        <Card>
          <Txt>{t('system:s26.data')}</Txt>
          <Txt color="inkMuted">{t('system:s26.applicantData')}</Txt>
        </Card>
      </View>
      <View style={{ gap: 16 }}>
        <SectionHeader title={t('system:s26.sourcesTitle')} />
        <ListGroup>
          {LEGAL_SOURCES.map((s) => (
            <ListRow
              key={s.url}
              title={s.label}
              icon={ExternalLink}
              accessibilityHint={t('system:s26.opensBrowser')}
              onPress={() => withLockSuspended(() => Linking.openURL(s.url))}
            />
          ))}
        </ListGroup>
      </View>
      <LegalFooter />
    </Screen>
  );
}
