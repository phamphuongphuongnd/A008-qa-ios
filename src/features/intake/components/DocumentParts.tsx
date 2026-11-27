/** S-10 pieces: one card per required document type, the income check, the file viewer sheet. */
import { Image } from 'expo-image';
import { Check, ExternalLink, FileText, Maximize2, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { DocumentRow, Income } from '@/db';
import { db } from '@/db';
import { isImageMime } from '@/files/paths';
import { files } from '@/files';
import { t } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Banner,
  Button,
  Card,
  ChoicePills,
  Chip,
  ConfirmDialog,
  Divider,
  DocThumb,
  EvidenceTag,
  MoneyField,
  Segmented,
  Sheet,
  StatusBadge,
  TextButton,
  Txt,
  showSnackbar,
} from '@/ui';

import { openStoredPdf } from '../documents/viewerNative';
import { incomeCheckFor, markChecked, PAY_FREQUENCIES, removeDocument, setIncomeDetails, type DocumentSlot } from '../documents/service';
import { checkedLine, incomeKindLabel, slotChip, slotHint, thumbLabel, tx } from '../screenModels';
import { ZoomViewer } from './ZoomViewer';

export function Thumb({ doc, label, onPress }: { doc: DocumentRow; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const image = isImageMime(doc.mime) && !doc.filePath.startsWith('sample/');
  return (
    <DocThumb label={label} checked={!!doc.checkedAt} onPress={onPress}>
      {image ? (
        <Image source={{ uri: files.uri(doc.filePath) }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : doc.mime === 'application/pdf' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <FileText color={colors.inkMuted} size={24} />
        </View>
      ) : undefined}
    </DocThumb>
  );
}

export function SlotCard({
  slot,
  incomes,
  onAdd,
  onOpen,
}: {
  slot: Pick<DocumentSlot, 'key' | 'type' | 'label' | 'state' | 'files'> & { required?: boolean };
  incomes: readonly Income[];
  onAdd: () => void;
  onOpen: (doc: DocumentRow) => void;
}) {
  const chip = slotChip(slot.state);
  const hint = slotHint(slot.type, slot.state);
  const unchecked = slot.files.filter((f) => !f.checkedAt);
  const checked = checkedLine(slot.files.map((f) => f.checkedAt));
  const proofs = slot.type === 'proof_of_income' ? slot.files : [];
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt variant="bodyStrong" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {slot.label}
        </Txt>
        {slot.required === false ? null : chip.kind === 'missing' ? (
          <StatusBadge outcome="missing" />
        ) : (
          <Chip tone={chip.tone} icon={slot.state === 'checked' ? Check : undefined} label={chip.label} />
        )}
      </View>
      {hint ? (
        <Txt variant="callout" color="inkMuted">
          {hint}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {slot.files.map((d, i) => (
          <Thumb key={d.id} doc={d} label={thumbLabel(slot.label, i, slot.files.length, !!d.checkedAt)} onPress={() => onOpen(d)} />
        ))}
        <DocThumb add label={t('intake:s10.addTitle', { label: slot.label })} onPress={onAdd} />
      </View>
      {proofs.map((d, i) => (
        <IncomeCheck key={d.id} doc={d} incomes={incomes} title={proofs.length > 1 ? t('intake:s10.incomeCheckFor', { n: i + 1 }) : t('intake:s10.incomeCheck')} />
      ))}
      {slot.files.length ? (
        unchecked.length ? (
          <Button
            variant="secondary"
            block
            icon={Check}
            label={t('intake:s10.markChecked')}
            onPress={() => unchecked.forEach((f) => markChecked(db, f.id, true))}
          />
        ) : checked ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt variant="callout" color="inkMuted">
              {checked}
            </Txt>
            <TextButton label={t('intake:s10.unmark')} onPress={() => slot.files.forEach((f) => markChecked(db, f.id, false))} />
          </View>
        ) : null
      ) : null}
      {proofs.length ? (
        <Txt variant="caption" color="inkMuted">
          {t('intake:s10.tip')}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Pay stub (gross per period + frequency) or letter (monthly amount) → "≈ $4,600/mo vs $5,200 stated (−12%)". */
export function IncomeCheck({ doc, incomes, title }: { doc: DocumentRow; incomes: readonly Income[]; title: string }) {
  const [kind, setKind] = useState<'pay_stub' | 'monthly'>(doc.monthlyCents != null && doc.payGrossCents == null ? 'monthly' : 'pay_stub');
  const state = incomeCheckFor(doc, incomes);
  const stated = incomes.filter((i) => i.monthlyCents != null);
  const linkOptions = stated.map((i) => ({ value: String(i.id), label: i.person || i.employer || incomeKindLabel(i.kind) }));
  return (
    <View style={{ gap: 12 }}>
      <Divider />
      <Txt variant="bodyStrong">{title}</Txt>
      <Segmented
        accessibilityLabel={title}
        options={[
          { value: 'pay_stub', label: t('intake:s10.payStub') },
          { value: 'monthly', label: t('intake:s10.letter') },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === 'pay_stub' ? (
        <>
          <MoneyField
            label={t('intake:s10.grossPerPeriod')}
            cents={doc.payGrossCents}
            onChangeCents={(c) => setIncomeDetails(db, doc.id, { kind: 'pay_stub', payGrossCents: c, payFrequency: doc.payFrequency })}
          />
          <View style={{ gap: 8 }}>
            <Txt variant="label">{t('intake:s10.payFrequency')}</Txt>
            <ChoicePills
              accessibilityLabel={t('intake:s10.payFrequency')}
              options={PAY_FREQUENCIES.map((f) => ({ value: f, label: tx(`intake:payFrequency.${f}`) }))}
              value={doc.payFrequency}
              onChange={(f) => setIncomeDetails(db, doc.id, { kind: 'pay_stub', payGrossCents: doc.payGrossCents, payFrequency: f })}
            />
          </View>
        </>
      ) : (
        <MoneyField label={t('intake:s10.monthlyOnDoc')} cents={doc.monthlyCents} onChangeCents={(c) => setIncomeDetails(db, doc.id, { kind: 'monthly', monthlyCents: c })} />
      )}
      {stated.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Txt variant="label">{t('intake:s10.whichIncome')}</Txt>
          <ChoicePills
            accessibilityLabel={t('intake:s10.whichIncome')}
            options={linkOptions}
            value={doc.incomeId != null ? String(doc.incomeId) : null}
            onChange={(v) => setIncomeDetails(db, doc.id, kind === 'pay_stub' ? { kind, payGrossCents: doc.payGrossCents, payFrequency: doc.payFrequency, incomeId: Number(v) } : { kind, monthlyCents: doc.monthlyCents, incomeId: Number(v) })}
          />
        </View>
      ) : null}
      {state.status === 'ok' ? (
        <Banner tone={state.check.mismatch ? 'warn' : 'info'} title={state.check.text}>
          {state.check.mismatch ? <EvidenceTag evidence="mismatch" /> : null}
        </Banner>
      ) : state.status === 'no_stated' ? (
        <Txt variant="callout" color="inkMuted">
          {t('intake:s10.noStated')}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * One file: preview, "View full screen" (pinch / drag / double-tap zoom, Android + iOS) or "Open PDF" (system print
 * preview, no copy), Mark as checked / Unmark, Delete (B-43).
 */
export function FileSheet({
  doc,
  title,
  onClose,
  markable = true,
}: {
  doc: DocumentRow | null;
  title: string;
  onClose: () => void;
  /** "Mark as checked" (S-10 documents). Off for the paper-form photos of S-08 (they are not C6 documents). */
  markable?: boolean;
}) {
  const { colors } = useTheme();
  const [askDelete, setAskDelete] = useState(false);
  const [full, setFull] = useState(false);
  if (!doc) return null;
  const real = !doc.filePath.startsWith('sample/');
  const image = isImageMime(doc.mime) && real;
  const pdf = doc.mime === 'application/pdf' && real;
  const openPdf = async () => {
    if (!(await openStoredPdf(doc.filePath))) showSnackbar({ message: t('intake:s10.openPdfFailed') });
  };
  return (
    <>
      <Sheet
        visible
        onClose={onClose}
        title={title}
        footer={
          <View style={{ gap: 8 }}>
            {!markable ? null : doc.checkedAt ? (
              <Button variant="secondary" block label={t('intake:s10.unmark')} onPress={() => markChecked(db, doc.id, false)} />
            ) : (
              <Button block icon={Check} label={t('intake:s10.markChecked')} onPress={() => markChecked(db, doc.id, true)} />
            )}
            <Button variant="dangerOutline" block icon={Trash2} label={t('common:actions.delete')} onPress={() => setAskDelete(true)} />
          </View>
        }
      >
        {image ? (
          <>
            <Pressable
              onPress={() => setFull(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={title}
              accessibilityHint={t('intake:s10.viewFull')}
              style={{ height: 360, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface2 }}
            >
              <Image source={{ uri: files.uri(doc.filePath) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
            </Pressable>
            <Button variant="secondary" block icon={Maximize2} label={t('intake:s10.viewFull')} onPress={() => setFull(true)} />
            {/* Inside the sheet's own modal: iOS cannot present a second modal next to it. */}
            <ZoomViewer uri={files.uri(doc.filePath)} title={title} visible={full} onClose={() => setFull(false)} />
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <FileText color={colors.inkMuted} size={40} />
            <Txt color="inkMuted">{t('intake:s10.pdf')}</Txt>
          </View>
        )}
        {pdf ? (
          <>
            <Button variant="secondary" block icon={ExternalLink} label={t('intake:s10.openPdf')} onPress={openPdf} />
            <Txt variant="caption" color="inkMuted">
              {t('intake:s10.openPdfHelp')}
            </Txt>
          </>
        ) : null}
        {doc.checkedAt ? (
          <Txt variant="callout" color="inkMuted">
            {checkedLine([doc.checkedAt])}
          </Txt>
        ) : null}
      </Sheet>
      <ConfirmDialog
        visible={askDelete}
        title={t('intake:s10.deleteTitle')}
        body={t('intake:s10.deleteBody')}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('common:actions.delete')}
        destructive
        onCancel={() => setAskDelete(false)}
        onConfirm={() => {
          setAskDelete(false);
          removeDocument(db, files.fileStore, doc.id);
          onClose();
        }}
      />
    </>
  );
}
