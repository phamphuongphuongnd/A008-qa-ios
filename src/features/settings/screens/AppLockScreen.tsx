/**
 * S-23 App lock (product.md S-23; not in the mockup → v2 design system): switch "Require Face ID / fingerprint to
 * open", "Lock after" Immediately / 1 min / 5 min, and the app PIN on phones with no biometrics or passcode.
 * Turning the lock on asks to unlock once (proves it works on this phone).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { AppBar, Button, FieldShell, ListGroup, ListRow, Screen, Segmented, Sheet, SwitchRow, Txt, showSnackbar } from '@/ui';

import { PinSetup } from '../components/PinFields';
import { isIos, useAuthCapability, useSettings } from '../hooks';
import { settingsActions } from '../index';
import { LOCK_AFTER_OPTIONS, type LockAfter } from '../lock';
import { unlockLandlord } from '../lockController';
import { expoAuthAdapter } from '../lockNative';
import { appLockView } from '../view';

export default function AppLockScreen() {
  'use no memo';
  const settings = useSettings();
  const cap = useAuthCapability();
  const [pinSheet, setPinSheet] = useState<null | 'enable' | 'change'>(null);
  const [busy, setBusy] = useState(false);

  if (!cap) return <Screen header={<AppBar title={t('system:s23.title')} />}>{null}</Screen>;
  const view = appLockView(settings, cap, isIos);

  const toggle = async (on: boolean) => {
    if (!on) {
      settingsActions.setAppLock(false, cap);
      return;
    }
    if (view.needsPinFirst) return setPinSheet('enable');
    if (!view.usesAppPin) {
      setBusy(true);
      const r = await unlockLandlord(expoAuthAdapter, settings, { prompt: t('system:lock.prompt'), cancel: t('common:actions.cancel') });
      setBusy(false);
      if (r !== 'success') return;
    }
    settingsActions.setAppLock(true, cap);
  };

  return (
    <Screen header={<AppBar title={t('system:s23.title')} />}>
      <ListGroup>
        <SwitchRow title={view.switchTitle} value={settings.appLock} onChange={toggle} disabled={busy} />
      </ListGroup>
      {view.showLockAfter ? (
        <FieldShell label={t('system:s23.lockAfter')}>
          <Segmented<LockAfter>
            accessibilityLabel={t('system:s23.lockAfter')}
            options={LOCK_AFTER_OPTIONS.map((v) => ({ value: v, label: t(`system:s23.after.${v}`) }))}
            value={settings.lockAfter}
            onChange={(v) => settingsActions.setLockAfter(v)}
          />
        </FieldShell>
      ) : null}
      {view.usesAppPin ? (
        <View style={{ gap: 8 }}>
          <Txt color="inkMuted">{t('system:s23.pinHint')}</Txt>
          {settings.appPinHash ? (
            <ListGroup>
              <ListRow title={t('system:s23.changePin')} chevron onPress={() => setPinSheet('change')} />
            </ListGroup>
          ) : (
            <Button label={t('system:s23.pinTitle')} variant="secondary" onPress={() => setPinSheet('change')} block />
          )}
        </View>
      ) : null}
      <Txt color="inkMuted">{t('system:s23.applicantModeNote')}</Txt>

      <Sheet visible={pinSheet != null} onClose={() => setPinSheet(null)} title={t('system:s23.pinTitle')}>
        <Txt color="inkMuted">{t('system:s23.pinHint')}</Txt>
        <PinSetup
          saveLabel={pinSheet === 'enable' ? t('system:s23.pinAndLock') : undefined}
          onSave={async (pin, again) => {
            const e = await settingsActions.setAppPin(pin, again, pinSheet === 'enable');
            if (!e) {
              setPinSheet(null);
              showSnackbar({ message: t('system:s23.pinSaved') });
            }
            return e;
          }}
        />
      </Sheet>
    </Screen>
  );
}
