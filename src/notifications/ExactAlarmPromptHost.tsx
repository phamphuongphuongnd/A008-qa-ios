/** Draws the exact-alarm question (./exactAlarmPrompt) with the app's ConfirmDialog. Mounted once in app/_layout.tsx. */
import { useSyncExternalStore } from 'react';

import { t } from '@/i18n';
import { ConfirmDialog } from '@/ui';

import { answerExactAlarmPrompt, isExactAlarmPromptOpen, subscribeExactAlarmPrompt } from './exactAlarmPrompt';

export function ExactAlarmPromptHost() {
  const open = useSyncExternalStore(subscribeExactAlarmPrompt, isExactAlarmPromptOpen, isExactAlarmPromptOpen);
  return (
    <ConfirmDialog
      visible={open}
      tone="accent"
      glyph="clock"
      title={t('system:notifications.exactTitle')}
      body={t('system:notifications.exactBody')}
      cancelLabel={t('system:notifications.exactLater')}
      confirmLabel={t('system:notifications.exactAllow')}
      onCancel={() => answerExactAlarmPrompt(false)}
      onConfirm={() => answerExactAlarmPrompt(true)}
    />
  );
}
