/**
 * S-21 About (mockup v2 "S-21 · About"): app icon + wordmark, "Version 1.0 (1) · No account · No servers", Legal & privacy
 * (S-26), Licenses (sheet), Send feedback (mailto — hidden while `FEEDBACK_EMAIL` is empty), "not legal advice" footer.
 */
import { FileText, Mail, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { font } from '@/theme';
import { AppBar, LegalFooter, ListGroup, ListRow, LogoMark, Screen, Sheet, Txt, Wordmark } from '@/ui';

import { aboutLine, feedbackMailto, licenseGroups } from '../about';
import { currentAppVersion } from '../appVersionNative';
import { withLockSuspended } from '../lockController';

export default function AboutScreen() {
  const [licenses, setLicenses] = useState(false);
  const mailto = feedbackMailto();
  return (
    <Screen header={<AppBar title={t('system:about.title')} />}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 12 }}>
        <LogoMark size={88} />
        <Wordmark height={30} />
        <Txt color="inkMuted" style={[font(400, 14, 20), { textAlign: 'center' }]}>
          {aboutLine(currentAppVersion())}
        </Txt>
      </View>
      <ListGroup>
        <ListRow title={t('system:s21.legal')} icon={Scale} chevron onPress={() => router.push(routes.legal())} />
        <ListRow title={t('system:about.licenses')} icon={FileText} chevron onPress={() => setLicenses(true)} />
        {mailto ? (
          <ListRow title={t('system:about.feedback')} icon={Mail} onPress={() => withLockSuspended(() => Linking.openURL(mailto))} />
        ) : null}
      </ListGroup>
      <LegalFooter />

      <Sheet visible={licenses} onClose={() => setLicenses(false)} title={t('system:about.licenses')}>
        <Txt color="inkMuted">{t('system:about.licensesIntro')}</Txt>
        {licenseGroups().map((g) => (
          <View key={g.license} style={{ gap: 4 }}>
            <Txt accessibilityRole="header" style={font(600, 15, 20)}>
              {g.license}
            </Txt>
            <Txt variant="caption" color="inkMuted">
              {g.names.join(', ')}
            </Txt>
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}
