/**
 * S-22 Backup & restore (product.md S-22, mockup v2 "S-22 Backup & restore"): last backup card · "Back up now" ·
 * Automatic backup Off / Weekly · "Restore from backup" · forget-password warning.
 * First backup asks for the backup password twice. Restore: pick file → password → "Replace all data?" → restore.
 */
import { CloudUpload, FolderOpen } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { backupActions, backupErrorText, formatBytes, useBackupStatus, validateBackupPassword, MIN_PASSWORD_LENGTH, type BackupStep, type OpenedBackup } from '@/backup';
import { formatDate } from '@/engine';
import { t } from '@/i18n';
import { font } from '@/theme';
import { AppBar, Banner, Button, Card, ConfirmDialog, Divider, FieldShell, Screen, Segmented, Sheet, TextButton, TextField, Txt, showSnackbar } from '@/ui';

import { isIos } from '../hooks';
import { backupView } from '../view';

type Busy = null | 'backup' | 'auto' | 'restore';

export default function BackupScreen() {
  'use no memo';
  const status = useBackupStatus();
  const view = backupView(status, isIos, formatBytes);
  const [busy, setBusy] = useState<Busy>(null);
  const [step, setStep] = useState<BackupStep | null>(null);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [restoreFile, setRestoreFile] = useState<Uint8Array | null>(null);
  const [opened, setOpened] = useState<OpenedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepLabel = step ? t(`system:s22.progress.${step}`) : undefined;

  const backUp = async () => {
    if (view.needsPassword) return setPasswordSheet(true);
    setBusy('backup');
    setError(null);
    try {
      const r = await backupActions.backUpNow(setStep);
      if (r.where !== 'not_shared') showSnackbar({ message: t('system:s22.done') });
    } catch (e) {
      setError(backupErrorText(e));
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const setAuto = async (mode: 'off' | 'weekly') => {
    if (mode === 'weekly' && view.needsPassword) return setPasswordSheet(true);
    setBusy('auto');
    setError(null);
    try {
      const r = await backupActions.setAutomatic(mode);
      if (r === 'done') showSnackbar({ message: t('system:s22.done') });
      else if (r === 'failed') setError(t('system:s22.autoFailed'));
    } finally {
      setBusy(null);
    }
  };

  const pickRestore = async () => {
    setError(null);
    try {
      const file = await backupActions.pickRestoreFile();
      if (file) setRestoreFile(file);
    } catch (e) {
      setError(backupErrorText(e));
    }
  };

  const restore = async () => {
    if (!opened) return;
    setBusy('restore');
    try {
      await backupActions.restore(opened, setStep);
      showSnackbar({ message: t('system:s22.restored') });
    } catch (e) {
      setError(backupErrorText(e));
    } finally {
      setOpened(null);
      setBusy(null);
      setStep(null);
    }
  };

  return (
    <Screen header={<AppBar title={t('system:s22.title')} />}>
      <Card>
        <Txt color="inkMuted" variant="caption">
          {t('system:s22.lastBackup')}
        </Txt>
        <Txt tabular style={font(600, 17, 24)}>
          {view.lastLine}
        </Txt>
        <Txt color="inkMuted">{t('system:s22.encrypted')}</Txt>
      </Card>

      {view.autoFailed ? (
        <Banner tone="warn" actions={[{ label: t('system:s22.changeFolder'), onPress: () => backupActions.changeFolder() }]}>
          {t('system:s22.autoFailed')}
        </Banner>
      ) : null}
      {error ? (
        <Banner tone="warn" title={error}>
          {null}
        </Banner>
      ) : null}

      <Button
        label={t('system:s22.backUpNow')}
        icon={CloudUpload}
        onPress={backUp}
        loading={busy === 'backup'}
        loadingLabel={stepLabel}
        disabled={busy != null && busy !== 'backup'}
        block
      />

      <FieldShell label={t('system:s22.automatic')} help={view.folderHelp}>
        <Segmented
          accessibilityLabel={t('system:s22.automatic')}
          options={[
            { value: 'off', label: t('system:s22.autoOff') },
            { value: 'weekly', label: t('system:s22.autoWeekly') },
          ]}
          value={status.autoBackup}
          onChange={(v) => setAuto(v)}
        />
      </FieldShell>
      {status.autoBackup === 'weekly' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <TextButton label={t('system:s22.changeFolder')} onPress={() => backupActions.changeFolder()} />
        </View>
      ) : null}

      <Divider />

      <Button
        label={t('system:s22.restore')}
        icon={FolderOpen}
        variant="secondary"
        onPress={pickRestore}
        loading={busy === 'restore'}
        loadingLabel={stepLabel}
        disabled={busy != null && busy !== 'restore'}
        block
      />
      <Banner tone="info">{t('system:s22.forgetWarning')}</Banner>

      <NewPasswordSheet
        visible={passwordSheet}
        onClose={() => setPasswordSheet(false)}
        onSaved={() => {
          setPasswordSheet(false);
          backUp();
        }}
      />
      <RestorePasswordSheet
        file={restoreFile}
        onClose={() => setRestoreFile(null)}
        onOpened={(o) => {
          setRestoreFile(null);
          setOpened(o);
        }}
      />
      <ConfirmDialog
        visible={!!opened}
        title={t('system:s22.replaceTitle')}
        body={
          opened
            ? t('system:s22.replaceBody', {
                date: formatDate(opened.createdAt.slice(0, 10)),
                rentals: t('system:s22.rentals', { count: opened.counts.rentals }),
                applicants: t('system:s22.applicants', { count: opened.counts.applicants }),
              })
            : undefined
        }
        confirmLabel={t('system:s22.replace')}
        destructive
        busy={busy === 'restore'}
        onCancel={() => setOpened(null)}
        onConfirm={restore}
      />
    </Screen>
  );
}

/** First backup: set the password (typed twice), with the warning. Deriving the key takes a moment. */
function NewPasswordSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const e = validateBackupPassword(pw, again);
    if (e) return setErr(e === 'short' ? t('system:s22.errors.passwordShort', { min: MIN_PASSWORD_LENGTH }) : t('system:s22.errors.passwordMismatch'));
    setSaving(true);
    try {
      await backupActions.setPassword(pw);
      setPw('');
      setAgain('');
      setErr(null);
      onSaved();
    } catch (x) {
      setErr(backupErrorText(x));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('system:s22.setPasswordTitle')}
      dirty={!!(pw || again)}
      footer={<Button label={t('system:s22.setPassword')} onPress={save} loading={saving} loadingLabel={t('system:s22.progress.deriving')} block />}
    >
      <Banner tone="warn">{t('system:s22.forgetWarning')}</Banner>
      <TextField label={t('system:s22.password')} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
      <TextField label={t('system:s22.passwordAgain')} value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" error={err} onSubmitEditing={save} />
    </Sheet>
  );
}

function RestorePasswordSheet({ file, onClose, onOpened }: { file: Uint8Array | null; onClose: () => void; onOpened: (o: OpenedBackup) => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (!file || !pw) return;
    setOpening(true);
    setErr(null);
    try {
      const o = await backupActions.open(file, pw);
      setPw('');
      onOpened(o);
    } catch (e) {
      setErr(backupErrorText(e));
    } finally {
      setOpening(false);
    }
  };
  return (
    <Sheet
      visible={!!file}
      onClose={() => {
        setPw('');
        setErr(null);
        onClose();
      }}
      title={t('system:s22.restore')}
      footer={<Button label={t('system:s22.openBackup')} onPress={open} disabled={!pw} loading={opening} loadingLabel={t('system:s22.progress.checking')} block />}
    >
      <TextField label={t('system:s22.enterPassword')} value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" error={err} onSubmitEditing={open} />
      <Txt color="inkMuted">{t('system:s22.restoreHelp')}</Txt>
    </Sheet>
  );
}
