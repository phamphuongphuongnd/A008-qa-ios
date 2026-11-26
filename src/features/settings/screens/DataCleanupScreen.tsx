/**
 * S-24 Data cleanup (product.md S-24, mockup v2 "S-24 Destructive confirm"): explanation · one card per closed rental
 * still holding not-selected applicants' data ("Delete their data", red outline) · confirm (safe left, red right) ·
 * "Remind me after a rental closes" 30 / 60 / 90 / 180 days / Off.
 */
import { Eraser, Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import { t } from '@/i18n';
import { refreshReminders } from '@/notifications';
import { font } from '@/theme';
import { AppBar, Button, Card, ChoicePills, ConfirmDialog, EmptyState, FieldShell, Screen, Txt, showSnackbar } from '@/ui';

import { CLEANUP_OPTIONS, type CleanupAfter } from '../actions';
import { cleanupConfirmTitle, type CleanupRow } from '../dataCleanup';
import { useCleanupRows, useSettings } from '../hooks';
import { settingsActions } from '../index';

const key = (d: CleanupAfter) => (d == null ? 'off' : String(d)) as '30' | '60' | '90' | '180' | 'off';

export default function DataCleanupScreen() {
  'use no memo';
  const settings = useSettings();
  const rows = useCleanupRows(settings.cleanupAfterDays);
  const [confirm, setConfirm] = useState<CleanupRow | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const n = await settingsActions.deleteNotSelected(confirm.rentalId);
      refreshReminders();
      showSnackbar({ message: t('system:s24.deleted', { count: n }) });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Screen header={<AppBar title={t('system:s24.title')} />}>
      <Txt color="inkMuted">{t('system:s24.explain')}</Txt>
      {rows.length === 0 ? (
        <EmptyState icon={Eraser} title={t('system:s24.emptyTitle')} body={t('system:s24.empty')} />
      ) : (
        rows.map((r) => (
          <Card key={r.rentalId}>
            <Txt style={font(600, 16, 22)}>{r.address}</Txt>
            <Txt color="inkMuted">{r.label}</Txt>
            <Button
              label={t('system:s24.deleteTheirData')}
              icon={Trash2}
              variant="dangerOutline"
              onPress={() => setConfirm(r)}
              accessibilityLabel={`${t('system:s24.deleteTheirData')}, ${r.address}`}
              block
            />
          </Card>
        ))
      )}
      <FieldShell label={t('system:s24.remindAfter')}>
        <ChoicePills
          accessibilityLabel={t('system:s24.remindAfter')}
          options={CLEANUP_OPTIONS.map((d) => ({ value: key(d), label: t(`system:s24.remind.${key(d)}`) }))}
          value={key(settings.cleanupAfterDays)}
          onChange={(v) => settingsActions.setCleanupAfter(v === 'off' ? null : (Number(v) as CleanupAfter))}
        />
      </FieldShell>
      <ConfirmDialog
        visible={!!confirm}
        glyph="trash"
        tone="danger"
        title={confirm ? cleanupConfirmTitle(confirm.applicantIds.length) : ''}
        body={t('system:s24.confirmBody')}
        confirmLabel={t('common:actions.delete')}
        destructive
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </Screen>
  );
}
