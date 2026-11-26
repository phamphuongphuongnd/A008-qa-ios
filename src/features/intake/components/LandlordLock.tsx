/**
 * Applicant mode: the indigo mode bar with the "Landlord" lock button, and the dialogs of leaving
 * (system lock → "Exit applicant mode?" / app PIN pad when the phone has no lock). product.md S-08a.
 */
import { useState, type ReactNode } from 'react';

import { verifyAppPin } from '@/features/settings';
import { t } from '@/i18n';
import { ConfirmDialog, haptics, ModeBar, TextField } from '@/ui';

import { unlockWithPin, type PinVerifier } from '../applicantMode/auth';
import { expoLocalAuthAdapter } from '../applicantMode/authNative';
import { useLandlordExit } from '../applicantMode/hooks';
import { useApplicantMode } from '../applicantMode/store';

export function useLandlordUnlock(verifyPin: PinVerifier = verifyAppPin): { request: () => void; dialogs: ReactNode } {
  const [mode] = useApplicantMode();
  const exit = useLandlordExit(expoLocalAuthAdapter);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = () => {
    if (busy) return;
    setBusy(true);
    exit
      .request()
      .then((r) => {
        if (r === 'needs_app_pin') setPinOpen(true);
        else if (r === 'failed') haptics.error();
      })
      .finally(() => setBusy(false));
  };

  const closePin = () => {
    setPinOpen(false);
    setPin('');
    setPinError(null);
    exit.cancel();
  };

  const dialogs = (
    <>
      <ConfirmDialog
        visible={mode.exit === 'confirm'}
        title={t('intake:mode.exitTitle')}
        body={t('intake:mode.exitBody')}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('intake:mode.exit')}
        onCancel={exit.cancel}
        onConfirm={exit.confirm}
      />
      <ConfirmDialog
        visible={pinOpen}
        title={t('intake:mode.enterPin')}
        glyph="lock"
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('common:actions.done')}
        confirmDisabled={pin.length < 4}
        busy={busy}
        onCancel={closePin}
        onConfirm={() => {
          setBusy(true);
          unlockWithPin(pin, verifyPin)
            .then((r) => {
              if (r === 'ok') {
                setPinOpen(false);
                setPin('');
                setPinError(null);
                exit.pinUnlocked();
              } else {
                haptics.error();
                setPinError(t('intake:mode.wrongPin'));
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        <TextField
          label={t('intake:mode.enterPin')}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          maxLength={6}
          error={pinError}
        />
      </ConfirmDialog>
    </>
  );
  return { request, dialogs };
}

/** Mode bar + its dialogs (S-08a, S-08 in applicant mode). */
export function ApplicantModeBar() {
  const { request, dialogs } = useLandlordUnlock();
  return (
    <>
      <ModeBar title={t('intake:s08a.title')} actionLabel={t('intake:mode.landlord')} onAction={request} />
      {dialogs}
    </>
  );
}
