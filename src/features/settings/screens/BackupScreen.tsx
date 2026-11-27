/**
 * S-22 Backup & restore (product.md S-22, mockup v2 "S-22 Backup & restore"): last backup card · "Back up now" ·
 * Automatic backup Off / Weekly · "Restore from backup" · forget-password warning.
 * First backup asks for the backup password twice, then carries on with what was tapped (B-67). A backup through the
 * share sheet asks "Did you save it?" before it counts as "Last backup": the sheet can't tell saved from cancelled
 * (B-68). Restore: pick file → password → "Replace all data?" → restore.
 */
import { CloudUpload, FolderOpen } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { backupActions, backupErrorText, formatBytes, useBackupStatus, validateBackupPassword, MIN_PASSWORD_LENGTH, type BackupStep, type MadeBackup, type OpenedBackup } from '@/backup';
import { formatDate } from '@/engine';
import { t } from '@/i18n';
import { font } from '@/theme';
import { AppBar, Banner, Button, Card, ConfirmDialog, Divider, FieldShell, Screen, Segmented, Sheet, TextButton, TextField, Txt, showSnackbar } from '@/ui';

import { isIos } from '../hooks';
import { backupView } from '../view';

type Busy = null | 'backup' | 'auto' | 'restore';
/** What the landlord tapped before the password sheet came up — it runs once the password is saved (B-67). */
type AfterPassword = 'backup' | 'weekly';

export default function BackupScreen() {
  'use no memo';
  const status = useBackupStatus();
  const view = backupView(status, isIos, formatBytes);
  const [busy, setBusy] = useState<Busy>(null);
  const [step, setStep] = useState<BackupStep | null>(null);
  /** Password sheet open, and what runs once the password is saved. */
  const [passwordFor, setPasswordFor] = useState<AfterPassword | null>(null);
  /** Share sheet closed: ask whether the file was saved before it counts as "Last backup" (B-68). */
  const [sharedMade, setSharedMade] = useState<MadeBackup | null>(null);
  const [restoreFile, setRestoreFile] = useState<Uint8Array | null>(null);
  const [opened, setOpened] = useState<OpenedBackup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepLabel = step ? t(`system:s22.progress.${step}`) : undefined;

  const backUp = () => (view.needsPassword ? setPasswordFor('backup') : runBackup());

  /** No password check here: right after the sheet saved it, this render's `view` still says "needs password" (B-67). */
  const runBackup = async () => {
    setBusy('backup');
    setError(null);
    try {
      const r = await backupActions.backUpNow(setStep);
      if (r.where === 'folder') showSnackbar({ message: t('system:s22.done') });
      else if (r.where === 'shared') setSharedMade(r.made);
    } catch (e) {
      setError(backupErrorText(e));
    } finally {
      setBusy(null);
      setStep(null);
    }
  };

  const setAuto = (mode: 'off' | 'weekly') => (mode === 'weekly' && view.needsPassword ? setPasswordFor('weekly') : runSetAuto(mode));

  const runSetAuto = async (mode: 'off' | 'weekly') => {
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
        visible={passwordFor != null}
        onClose={() => setPasswordFor(null)}
        onSaved={() => {
          const next = passwordFor;
          setPasswordFor(null);
          if (next === 'weekly') runSetAuto('weekly');
          else runBackup();
        }}
      />
      <ConfirmDialog
        visible={!!sharedMade}
        title={t('system:s22.sharedTitle')}
        body={t('system:s22.sharedBody')}
        cancelLabel={t('system:s22.sharedNo')}
        confirmLabel={t('system:s22.sharedYes')}
        onCancel={() => setSharedMade(null)}
        onConfirm={async () => {
          const made = sharedMade;
          setSharedMade(null);
          if (!made) return;
          await backupActions.confirmShared(made);
          showSnackbar({ message: t('system:s22.done') });
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
  // B-72: nothing typed (nor its error) survives Discard / close — the sheet opens empty every time.
  const reset = () => {
    setPw('');
    setAgain('');
    setErr(null);
  };
  const save = async () => {
    if (saving) return;
    const e = validateBackupPassword(pw, again);
    if (e) return setErr(e === 'short' ? t('system:s22.errors.passwordShort', { min: MIN_PASSWORD_LENGTH }) : t('system:s22.errors.passwordMismatch'));
    setErr(null); // B-72: an old "don't match" must not sit under "Preparing encryption…"
    setSaving(true);
    try {
      await backupActions.setPassword(pw);
      reset();
      onSaved();
    } catch (x) {
      setErr(backupErrorText(x));
    } finally {
      setSaving(false);
    }
  };
  // Typing in either field clears the error; Save checks again.
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (err) setErr(null);
  };
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (saving) return; // deriving the key: closing now would drop the backup the landlord asked for
        reset();
        onClose();
      }}
      title={t('system:s22.setPasswordTitle')}
      dirty={!saving && !!(pw || again)}
      footer={<Button label={t('system:s22.setPassword')} onPress={save} loading={saving} loadingLabel={t('system:s22.progress.deriving')} block />}
    >
      <Banner tone="warn">{t('system:s22.forgetWarning')}</Banner>
      <TextField label={t('system:s22.password')} value={pw} onChangeText={edit(setPw)} secureTextEntry autoComplete="new-password" disabled={saving} />
      <TextField
        label={t('system:s22.passwordAgain')}
        value={again}
        onChangeText={edit(setAgain)}
        secureTextEntry
        autoComplete="new-password"
        disabled={saving}
        error={err}
        onSubmitEditing={save}
      />
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
      <TextField
        label={t('system:s22.enterPassword')}
        value={pw}
        onChangeText={(v) => {
          setPw(v);
          if (err) setErr(null);
        }}
        secureTextEntry
        autoComplete="current-password"
        error={err}
        onSubmitEditing={open}
      />
      <Txt color="inkMuted">{t('system:s22.restoreHelp')}</Txt>
    </Sheet>
  );
}
