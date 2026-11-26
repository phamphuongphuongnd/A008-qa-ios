/** "+ Add" flow shared by S-10 and S-08's paper-form card: source sheet → native picker → saved document row. */
import { useState, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { db } from '@/db';
import { files } from '@/files';
import { t } from '@/i18n';
import { Banner, haptics, showSnackbar } from '@/ui';

import { pick, sourcesAfter, type PickSource } from '../documents/picker';
import { expoAttachmentPicker } from '../documents/pickerNative';
import { addPickedDocument, type AddDocumentInput } from '../documents/service';
import { AddSourceSheet } from './Inputs';

export type AddTarget = Omit<AddDocumentInput, 'picked'> & { title: string };

export function usePickFile(): { open: (target: AddTarget) => void; ui: ReactNode; cameraBanner: ReactNode } {
  const [target, setTarget] = useState<AddTarget | null>(null);
  const [sources, setSources] = useState<PickSource[]>(['camera', 'library', 'file']);
  const [cameraDenied, setCameraDenied] = useState(false);

  const onPick = async (source: PickSource) => {
    if (!target) return;
    const r = await pick(expoAttachmentPicker, source);
    if (r.status === 'denied') {
      setCameraDenied(true);
      setSources((s) => sourcesAfter(r, s));
      return;
    }
    if (r.status === 'cancelled') return;
    setTarget(null);
    if (r.status === 'error') {
      showSnackbar({ message: t('intake:s10.addFailed') });
      return;
    }
    try {
      const { title: _title, ...input } = target;
      void _title;
      await addPickedDocument(db, files, { ...input, picked: r });
      haptics.success();
    } catch {
      haptics.error();
      showSnackbar({ message: t('intake:s10.addFailed') });
    }
  };

  return {
    open: setTarget,
    ui: <AddSourceSheet visible={target != null} title={target?.title ?? ''} sources={sources} onPick={onPick} onClose={() => setTarget(null)} />,
    cameraBanner: cameraDenied ? (
      <Banner tone="info" actions={[{ label: t('intake:s10.openSettings'), onPress: () => void Linking.openSettings() }]}>
        {t('intake:s10.cameraDenied')}
      </Banner>
    ) : null,
  };
}
