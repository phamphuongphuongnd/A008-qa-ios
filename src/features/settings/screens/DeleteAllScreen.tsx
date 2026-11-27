/**
 * S-27 Delete all data (product.md S-27; v2 design system): explanation · type DELETE · red button → everything is
 * erased → S-01 Onboarding.
 */
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { AppBar, Banner, Button, ButtonBar, Screen, TextField, showSnackbar } from '@/ui';

import { isDeleteConfirmed } from '../dataCleanup';
import { settingsActions } from '../index';

export default function DeleteAllScreen() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = isDeleteConfirmed(text);

  const run = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await settingsActions.deleteAll();
      // B-40: back down to the tabs; with `onboarded` off the root stack's guard swaps them for S-01 → stack [S-01].
      // (Replacing S-27 with S-01 raced the settings store: S-01 was still guarded → empty S-02 instead.)
      router.dismissTo(routes.rentals());
      showSnackbar({ message: t('system:s27.done') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<AppBar title={t('system:s27.title')} />}
      footer={
        <ButtonBar>
          <Button label={t('system:s27.button')} icon={Trash2} variant="danger" onPress={run} disabled={!ok} loading={busy} block />
        </ButtonBar>
      }
    >
      <Banner tone="warn" title={t('system:s27.warnTitle')}>
        {t('system:s27.explain')}
      </Banner>
      <TextField
        label={t('system:s27.typeToConfirm')}
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        onSubmitEditing={run}
      />
    </Screen>
  );
}
