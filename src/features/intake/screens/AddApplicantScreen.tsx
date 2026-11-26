/**
 * S-07 Add applicant (formSheet) — product.md §5 S-07, mockup v2 "S-07 Add applicant · 3 ways in".
 * Enter an application → S-08 (new landlord draft) · Hand the phone → S-08a (only if the landlord has a way out) ·
 * Print a blank application → PDF → share sheet.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileText, Printer, ShieldAlert, Smartphone, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db';
import { withLockSuspended } from '@/features/settings/lockController';
import { t } from '@/i18n';
import { parseId, routes } from '@/routes';
import { Banner, BigOption, EmptyState, haptics, showSnackbar, Txt } from '@/ui';
import { useTheme } from '@/theme';

import { enterApplicantMode } from '../applicantMode/actions';
import { expoLocalAuthAdapter } from '../applicantMode/authNative';
import { shareBlankApplication } from '../blankPdf';
import { createDraft } from '../form/service';
import { useIntakeRental } from '../hooks/useIntakeData';

export default function AddApplicantScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const rentalId = parseId(useLocalSearchParams<{ rentalId?: string }>().rentalId);
  const rental = useIntakeRental(db, rentalId);
  const [needPin, setNeedPin] = useState(false);
  const [busy, setBusy] = useState<null | 'hand' | 'print'>(null);

  if (rentalId == null || !rental)
    return (
      <View style={{ backgroundColor: colors.surface0, padding: 16 }}>
        <EmptyState icon={X} title={t('intake:s07.rentalMissing')} />
      </View>
    );

  const enter = () => {
    const id = createDraft(db, { rentalId, mode: 'landlord' });
    router.replace(routes.applicationEdit(id, 1));
  };

  const hand = async () => {
    if (busy) return;
    setBusy('hand');
    try {
      const r = await enterApplicantMode(db, expoLocalAuthAdapter, rentalId);
      if (r.ok) router.replace(routes.applicantModeStart(rentalId));
      else {
        haptics.error();
        setNeedPin(true);
      }
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (busy) return;
    setBusy('print');
    try {
      await withLockSuspended(() => shareBlankApplication(db, rentalId));
    } catch {
      showSnackbar({ message: t('intake:s07.pdfFailed') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View id="S-07" style={{ backgroundColor: colors.surface0, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 14 }}>
      <Txt variant="title2" accessibilityRole="header">
        {t('intake:s07.title')}
      </Txt>
      <BigOption icon={FileText} title={t('intake:s07.enter')} description={t('intake:s07.enterHint')} onPress={enter} />
      <BigOption icon={Smartphone} title={t('intake:s07.hand')} description={t('intake:s07.handHint')} onPress={() => void hand()} />
      {needPin ? (
        <Banner tone="warn" icon={ShieldAlert} actions={[{ label: t('intake:s07.setPin'), onPress: () => router.push(routes.appLock()) }]}>
          {t('intake:s07.setPinFirst')}
        </Banner>
      ) : null}
      <BigOption icon={Printer} title={t('intake:s07.print')} description={t('intake:s07.printHint')} onPress={() => void print()} />
      <Txt variant="caption" color="inkMuted">
        {t('intake:s07.noSsn')}
      </Txt>
    </View>
  );
}
