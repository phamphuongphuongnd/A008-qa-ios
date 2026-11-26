/**
 * S-08b Applicant mode — done (product.md §5 S-08b, mockup v2 "Submitted · tap 3× → biometric"). Nothing else on
 * screen; 3 taps (or a minute without a touch) ask for the landlord's lock, then back to the rental hub (S-06).
 */
import { useLocalSearchParams } from 'expo-router';
import { Check, Smartphone } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { db, getApplicant } from '@/db';
import { t } from '@/i18n';
import { parseId } from '@/routes';
import { font, useTheme } from '@/theme';
import { Card, Txt } from '@/ui';

import { canAccessApplicant } from '../applicantMode/guard';
import { DONE_IDLE_MS, registerTap } from '../applicantMode/machine';
import { useApplicantMode } from '../applicantMode/store';
import { useLandlordUnlock } from '../components/LandlordLock';
import { firstName } from '../form/model';
import { doneText } from '../screenModels';

export default function ApplicantModeDoneScreen() {
  const { colors } = useTheme();
  const id = parseId(useLocalSearchParams<{ id?: string }>().id);
  const [mode] = useApplicantMode();
  const { request, dialogs } = useLandlordUnlock();
  const taps = useRef<number[]>([]);
  const lastTouch = useRef(0);

  const applicant = id != null && canAccessApplicant(mode, id) ? getApplicant(db, id) : null;
  const text = doneText(firstName(applicant?.fullName ?? ''), mode.receivedAt ?? applicant?.receivedAt ?? null);

  // No touch for a minute → ask for the lock.
  useEffect(() => {
    if (mode.phase !== 'done' || mode.exit !== 'none') return;
    if (!lastTouch.current) lastTouch.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current >= DONE_IDLE_MS) {
        lastTouch.current = Date.now();
        request();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [mode.phase, mode.exit, request]);

  return (
    <Pressable
      id="S-08b"
      style={{ flex: 1, backgroundColor: colors.surface0 }}
      accessibilityHint={t('intake:s08b.a11yUnlock')}
      onPress={() => {
        const now = Date.now();
        lastTouch.current = now;
        const r = registerTap(taps.current, now);
        taps.current = r.taps;
        if (r.trigger) request();
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Check color={colors.accent} size={44} strokeWidth={2.4} />
        </View>
        <Txt accessibilityRole="header" align="center" style={font(700, 28, 34)}>
          {text.thanks}
        </Txt>
        {text.received ? (
          <Txt align="center" tabular style={[font(400, 16, 24), { color: colors.inkMuted }]}>
            {text.received}
          </Txt>
        ) : null}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <Smartphone color={colors.accent} size={24} strokeWidth={2} />
          <Txt style={font(600, 17, 24)}>{t('intake:s08b.handBack')}</Txt>
        </Card>
      </View>
      {dialogs}
    </Pressable>
  );
}
