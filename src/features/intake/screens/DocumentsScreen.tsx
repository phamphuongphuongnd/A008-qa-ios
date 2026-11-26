/**
 * S-10 Documents — product.md §5 S-10, mockup v2 "Documents · pay stub below 90% → Mismatch" / "Missing documents ·
 * add sheet". Required types come from the rental's C6; "+ Add" → Camera · Photos · PDF.
 */
import { useLocalSearchParams } from 'expo-router';
import { FolderOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { db, type DocumentRow } from '@/db';
import { t } from '@/i18n';
import { parseId } from '@/routes';
import { AppBar, EmptyState, Screen } from '@/ui';

import { FileSheet, SlotCard } from '../components/DocumentParts';
import { usePickFile } from '../components/usePickFile';
import { useApplicantDocuments } from '../hooks/useIntakeData';

export default function DocumentsScreen() {
  return (
    <View id="S-10" style={{ flex: 1 }}>
      <DocumentsBody />
    </View>
  );
}

function DocumentsBody() {
  const id = parseId(useLocalSearchParams<{ id?: string }>().id);
  const data = useApplicantDocuments(db, id);
  const picker = usePickFile();
  const [open, setOpen] = useState<{ docId: number; title: string } | null>(null);

  if (id == null || !data)
    return (
      <Screen header={<AppBar title={t('intake:s10.title')} />}>
        <EmptyState icon={X} title={t('intake:s08.notFound')} />
      </Screen>
    );

  const all: DocumentRow[] = [...data.slots.flatMap((s) => s.files), ...data.otherFiles];
  const openDoc = open ? (all.find((d) => d.id === open.docId) ?? null) : null;
  const addOther = () => picker.open({ applicantId: id, type: 'other', title: t('intake:s10.otherFiles') });

  return (
    <Screen header={<AppBar title={t('intake:s10.title')} subtitle={data.applicant.fullName} />}>
      {picker.cameraBanner}
      {data.slots.length === 0 && data.otherFiles.length === 0 ? (
        <EmptyState icon={FolderOpen} title={t('intake:s10.empty')} primary={{ label: t('intake:s10.add'), onPress: addOther }} />
      ) : (
        <>
          {data.slots.map((s) => (
            <SlotCard
              key={s.key}
              slot={s}
              incomes={data.incomes}
              onAdd={() => picker.open({ applicantId: id, type: s.type, label: s.otherLabel, title: t('intake:s10.addTitle', { label: s.label }) })}
              onOpen={(d) => setOpen({ docId: d.id, title: s.label })}
            />
          ))}
          <SlotCard
            slot={{ key: 'other-files', type: 'other', label: t('intake:s10.otherFiles'), state: data.otherFiles.length ? 'provided' : 'missing', files: data.otherFiles, required: false }}
            incomes={data.incomes}
            onAdd={addOther}
            onOpen={(d) => setOpen({ docId: d.id, title: d.label ?? t('intake:s10.otherFiles') })}
          />
        </>
      )}
      {picker.ui}
      <FileSheet doc={openDoc} title={open?.title ?? ''} onClose={() => setOpen(null)} />
    </Screen>
  );
}
