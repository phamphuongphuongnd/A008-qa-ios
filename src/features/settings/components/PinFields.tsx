/**
 * App PIN entry (4–6 digits): one field to unlock, two to set. Numeric keyboard, hidden digits.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { Button, TextField } from '@/ui';

import { validateNewPin, type PinError } from '../lock';

const digitsOnly = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export function pinErrorText(e: PinError | null): string | null {
  if (e === 'format') return t('system:lock.errors.pinFormat');
  if (e === 'mismatch') return t('system:lock.errors.pinMismatch');
  return null;
}

/** Unlock with the app PIN. `error` / `blockedSeconds` come from the caller (unlockWithPin). */
export function PinUnlock({ onSubmit, error, blockedSeconds }: { onSubmit: (pin: string) => void; error?: string | null; blockedSeconds?: number }) {
  const [pin, setPin] = useState('');
  const blocked = (blockedSeconds ?? 0) > 0;
  const submit = () => {
    if (pin.length < 4 || blocked) return;
    onSubmit(pin);
    setPin('');
  };
  return (
    <View style={{ gap: 12, alignSelf: 'stretch' }}>
      <TextField
        label={t('system:lock.enterPin')}
        value={pin}
        onChangeText={(v) => setPin(digitsOnly(v))}
        keyboardType="number-pad"
        secureTextEntry
        autoFocus
        maxLength={6}
        onSubmitEditing={submit}
        error={blocked ? t('system:lock.blocked', { seconds: blockedSeconds }) : error}
      />
      <Button label={t('system:lock.unlock')} onPress={submit} disabled={pin.length < 4 || blocked} block />
    </View>
  );
}

/** Set / change the app PIN: typed twice. `onSave` returns the error (null = saved). */
export function PinSetup({ onSave, saveLabel }: { onSave: (pin: string, again: string) => PinError | null; saveLabel?: string }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<PinError | null>(null);
  const save = () => {
    const e = validateNewPin(pin, again) ?? onSave(pin, again);
    setError(e);
  };
  return (
    <View style={{ gap: 12 }}>
      <TextField
        label={t('system:s23.pin')}
        value={pin}
        onChangeText={(v) => setPin(digitsOnly(v))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        error={error === 'format' ? pinErrorText(error) : null}
      />
      <TextField
        label={t('system:s23.pinAgain')}
        value={again}
        onChangeText={(v) => setAgain(digitsOnly(v))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        onSubmitEditing={save}
        error={error === 'mismatch' ? pinErrorText(error) : null}
      />
      <Button label={saveLabel ?? t('common:actions.save')} onPress={save} disabled={pin.length < 4 || again.length < 4} block />
    </View>
  );
}
