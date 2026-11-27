/**
 * S-21 Settings — tab 3 (product.md S-21, mockup v2 "S-21 Settings"). Rows from `settingsSections` (view.ts);
 * name / contact, appearance and reminders open sheets here; the rest push their screens.
 */
import { Bell, CloudUpload, Eraser, FlaskConical, Lock, SunMoon } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { db, useLive } from '@/db';
import { hasSampleRental, loadSample } from '@/features/onboarding/onboarding';
import { removeSampleRental } from '@/features/onboarding/hooks';
import { t } from '@/i18n';
import { refreshReminders } from '@/notifications';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { setThemePreference, useThemePreference } from '@/theme/preference';
import {
  Button,
  ConfirmDialog,
  LargeTitle,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  SwitchRow,
  TextField,
  Txt,
  showSnackbar,
  type IconComponent,
} from '@/ui';

import { useAuthCapability, useCleanupCandidates, useSettings, isIos } from '../hooks';
import { settingsActions } from '../index';
import type { ContactErrors } from '../summary';
import { currentAppVersion } from '../appVersionNative';
import { settingsSections, type SettingsRowKey } from '../view';

const ICONS: Partial<Record<SettingsRowKey, IconComponent>> = {
  appLock: Lock,
  backup: CloudUpload,
  cleanup: Eraser,
  appearance: SunMoon,
  reminders: Bell,
  sample: FlaskConical,
};

type SheetKind = 'name' | 'contact' | 'appearance' | 'reminders' | null;

export default function SettingsScreen() {
  'use no memo';
  const settings = useSettings();
  const cap = useAuthCapability();
  const cleanup = useCleanupCandidates();
  const hasSample = useLive(() => hasSampleRental(db), [], ['rentals']);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const sections = settingsSections({
    settings,
    now: new Date(),
    biometric: cap?.biometric ?? null,
    ios: isIos,
    cleanupCount: cleanup.length,
    hasSample,
    appVersion: currentAppVersion(),
  });

  const onRow = (key: SettingsRowKey) => {
    switch (key) {
      case 'name':
      case 'contact':
      case 'appearance':
      case 'reminders':
        setSheet(key);
        return;
      case 'appLock':
        return router.push(routes.appLock());
      case 'backup':
        return router.push(routes.backup());
      case 'cleanup':
        return router.push(routes.dataCleanup());
      case 'legal':
        return router.push(routes.legal());
      case 'deleteAll':
        return router.push(routes.deleteAll());
      case 'sample':
        if (hasSample) return setConfirmRemove(true);
        {
          const id = loadSample(db);
          refreshReminders();
          showSnackbar({ message: t('system:s21.sampleLoaded'), actionLabel: t('system:s21.open'), onAction: () => router.push(routes.rentalHub(id)) });
        }
        return;
      case 'about':
        return router.push(routes.about());
    }
  };

  return (
    <Screen header={<LargeTitle title={t('system:s21.title')} />} bottomInset={false}>
      {sections.map((s, i) => (
        <View key={s.title ?? `s${i}`} style={s.title ? undefined : { gap: 16 }}>
          {s.title ? <SectionHeader title={s.title} /> : null}
          <ListGroup>
            {s.rows.map((r) => (
              <ListRow
                key={r.key}
                title={r.title}
                value={r.value}
                icon={ICONS[r.key]}
                chevron={r.chevron}
                danger={r.danger}
                onPress={() => onRow(r.key)}
              />
            ))}
          </ListGroup>
        </View>
      ))}

      <NameSheet visible={sheet === 'name'} onClose={() => setSheet(null)} initial={settings.landlordName} contact={settings} />
      <ContactSheet visible={sheet === 'contact'} onClose={() => setSheet(null)} contact={settings} />
      <AppearanceSheet visible={sheet === 'appearance'} onClose={() => setSheet(null)} />
      <RemindersSheet visible={sheet === 'reminders'} onClose={() => setSheet(null)} value={settings.reminders} />
      <ConfirmDialog
        visible={confirmRemove}
        title={t('system:s21.removeSampleConfirm')}
        confirmLabel={t('common:actions.delete')}
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          removeSampleRental();
          setConfirmRemove(false);
          showSnackbar({ message: t('system:s21.sampleRemoved') });
        }}
      />
    </Screen>
  );
}

type Contact = { landlordName: string; landlordAddress: string; landlordPhone: string };

function NameSheet({ visible, onClose, initial, contact }: { visible: boolean; onClose: () => void; initial: string; contact: Contact }) {
  const [name, setName] = useState(initial);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [shownFor, setShownFor] = useState(false);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) {
      setName(initial);
      setErrors({});
    }
  }
  const save = () => {
    const e = settingsActions.saveContact({ ...contact, landlordName: name });
    setErrors(e);
    if (!Object.keys(e).length) onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('system:s21.yourName')}
      dirty={name !== initial}
      footer={<Button label={t('common:actions.save')} onPress={save} block />}
    >
      <TextField
        label={t('system:s21.yourName')}
        help={t('system:s21.nameHelp')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        error={errors.landlordName}
        onSubmitEditing={save}
      />
    </Sheet>
  );
}

function ContactSheet({ visible, onClose, contact }: { visible: boolean; onClose: () => void; contact: Contact }) {
  const [address, setAddress] = useState(contact.landlordAddress);
  const [phone, setPhone] = useState(contact.landlordPhone);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [shownFor, setShownFor] = useState(false);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) {
      setAddress(contact.landlordAddress);
      setPhone(contact.landlordPhone);
      setErrors({});
    }
  }
  const save = () => {
    const e = settingsActions.saveContact({ ...contact, landlordAddress: address, landlordPhone: phone });
    setErrors(e);
    if (!Object.keys(e).length) onClose();
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('system:s21.contact')}
      dirty={address !== contact.landlordAddress || phone !== contact.landlordPhone}
      footer={<Button label={t('common:actions.save')} onPress={save} block />}
    >
      <Txt color="inkMuted">{t('system:s21.contactHelp')}</Txt>
      <TextField
        label={t('system:s21.address')}
        value={address}
        onChangeText={setAddress}
        multiline
        autoComplete="postal-address"
        error={errors.landlordAddress}
      />
      <TextField label={t('system:s21.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" error={errors.landlordPhone} />
    </Sheet>
  );
}

function AppearanceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useThemePreference();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('system:s21.appearance')}>
      <Segmented
        accessibilityLabel={t('system:s21.appearance')}
        options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`system:s21.theme.${v}`) }))}
        value={theme}
        onChange={(v) => setThemePreference(v)}
      />
    </Sheet>
  );
}

function RemindersSheet({ visible, onClose, value }: { visible: boolean; onClose: () => void; value: { backup: boolean; cleanup: boolean; timers: boolean } }) {
  const [blocked, setBlocked] = useState(false);
  const set = async (patch: Partial<typeof value>) => {
    const allowed = await settingsActions.setReminders({ ...value, ...patch });
    setBlocked(!allowed && Object.values({ ...value, ...patch }).some(Boolean));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('system:s21.reminders')}>
      <SwitchRow title={t('system:s21.remindBackup')} description={t('system:s21.remindBackupHelp')} value={value.backup} onChange={(v) => set({ backup: v })} />
      <SwitchRow title={t('system:s21.remindCleanup')} description={t('system:s21.remindCleanupHelp')} value={value.cleanup} onChange={(v) => set({ cleanup: v })} />
      <SwitchRow title={t('system:s21.remindTimers')} description={t('system:s21.remindTimersHelp')} value={value.timers} onChange={(v) => set({ timers: v })} />
      {blocked ? (
        <View style={{ gap: 8 }}>
          <Txt color="inkMuted">{t('system:s21.notificationsOff')}</Txt>
          <Button label={t('system:s21.openSystemSettings')} variant="secondary" onPress={() => Linking.openSettings()} block />
        </View>
      ) : null}
    </Sheet>
  );
}
