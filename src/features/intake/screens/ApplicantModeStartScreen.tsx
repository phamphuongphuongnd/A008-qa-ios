/**
 * S-08a Applicant mode — hand-over screen (product.md §5 S-08a, mockup v2 "Handover screen"). Full screen, no tabs;
 * "Landlord" (mode bar) is the only way out and needs biometrics / the device code.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, ShieldAlert, Smartphone } from 'lucide-react-native';
import { View } from 'react-native';

import { db } from '@/db';
import { t } from '@/i18n';
import { parseId, routes } from '@/routes';
import { font, useTheme } from '@/theme';
import { Button, Card, EmptyState, LogoMark, Screen, Txt } from '@/ui';

import { startApplicantForm } from '../applicantMode/actions';
import { useApplicantMode } from '../applicantMode/store';
import { ApplicantModeBar } from '../components/LandlordLock';
import { useIntakeRental } from '../hooks/useIntakeData';

export default function ApplicantModeStartScreen() {
  return (
    <View id="S-08a" style={{ flex: 1 }}>
      <StartBody />
    </View>
  );
}

function StartBody() {
  const router = useRouter();
  const { colors } = useTheme();
  const rentalId = parseId(useLocalSearchParams<{ rentalId?: string }>().rentalId);
  const [mode] = useApplicantMode();
  const rental = useIntakeRental(db, rentalId);

  // Only reachable after S-07 turned the mode on for this rental.
  if (mode.phase !== 'start' || mode.rentalId !== rentalId || !rental)
    return (
      <Screen header={null}>
        <EmptyState
          icon={Smartphone}
          title={t('intake:s08a.notActive')}
          primary={mode.phase === 'off' ? { label: t('intake:s08a.backToRentals'), onPress: () => router.replace(routes.rentals()) } : undefined}
        />
      </Screen>
    );

  const line = (Icon: typeof Clock, text: string, strong?: boolean) => (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon color={colors.accent} size={20} strokeWidth={2} />
      <Txt style={[font(strong ? 600 : 400, 15, 22), { flex: 1 }]}>{text}</Txt>
    </View>
  );

  return (
    <Screen
      topInset={false}
      header={<ApplicantModeBar />}
      contentStyle={{ paddingTop: 32, paddingHorizontal: 24, gap: 20, flexGrow: 1 }}
      footer={
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            block
            label={t('intake:s08a.start')}
            onPress={() => {
              const id = startApplicantForm(db);
              router.replace(routes.applicantModeForm(id, 1));
            }}
          />
        </View>
      }
    >
      <LogoMark />
      <View style={{ gap: 10 }}>
        <Txt style={[font(500, 14, 20), { color: colors.inkMuted }]}>{t('intake:s08a.kicker')}</Txt>
        <Txt accessibilityRole="header" style={font(700, 28, 34, -0.02)}>
          {t('intake:s08a.applicationFor', { address: rental.address })}
        </Txt>
      </View>
      <Card>
        {line(Smartphone, t('intake:s08a.savedOnPhone'))}
        {line(ShieldAlert, t('intake:s08a.noSsn'), true)}
        {line(Clock, t('intake:s08a.duration'))}
      </Card>
    </Screen>
  );
}
