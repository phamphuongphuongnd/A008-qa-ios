/**
 * Attempts log (S-11, S-12): list of tries, "+ Log attempt" sheet, and the "Mark as unreachable" card that appears once
 * the engine rule holds (≥ 3 failed tries by ≥ 2 methods). Long-press / trailing button deletes a try (snackbar Undo is
 * not offered: the log is a record — a confirm dialog is used instead).
 */
import { Mail, MessageSquare, Phone, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { AttemptMethod, AttemptResult } from '@/engine';
import type { Attempt } from '@/db/types';
import { t } from '@/i18n';
import { Button, Card, ChoicePills, ConfirmDialog, DateField, FieldShell, IconButton, ListGroup, ListRow, SectionHeader, Sheet, Txt, haptics } from '@/ui';

import { ATTEMPT_METHODS, ATTEMPT_RESULTS, attemptResultKey, attemptTimeText, localDate, localTimestamp } from '../common';
import type { unreachableState } from '../landlord';
import type { AttemptInput } from '../service';
import { Hint } from './VerifyParts';

const METHOD_ICON = { call: Phone, email: Mail, text: MessageSquare } as const;

export function resultLabel(method: AttemptMethod, result: AttemptResult): string {
  return t(`verify:${attemptResultKey(method, result)}` as 'verify:attempts.result.reached');
}

/** An attempt on another day is stored at noon local time (the sheet asks for the day; today = now). */
export function attemptAt(day: string, now: Date): string {
  if (day === localDate(now)) return localTimestamp(now);
  const [y, m, d] = day.split('-').map(Number);
  return localTimestamp(new Date(y, m - 1, d, 12, 0, 0));
}

export function AttemptsSection({
  attempts,
  unreachable,
  onLog,
  onDelete,
  onMarkUnreachable,
  onClearUnreachable,
  now = new Date(),
}: {
  attempts: readonly Attempt[];
  unreachable: ReturnType<typeof unreachableState>;
  onLog: (input: AttemptInput) => void;
  onDelete: (attemptId: number) => void;
  onMarkUnreachable: () => void;
  onClearUnreachable: () => void;
  now?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Attempt | null>(null);
  return (
    <>
      <SectionHeader title={t('verify:attempts.title')} />
      <ListGroup>
        {attempts.map((a) => (
          <ListRow
            key={a.id}
            icon={METHOD_ICON[a.method]}
            title={resultLabel(a.method, a.result)}
            subtitle={`${t(`verify:attempts.method.${a.method}`)} · ${attemptTimeText(a.at)}`}
            right={<IconButton icon={Trash2} accessibilityLabel={t('verify:attempts.delete')} onPress={() => setToDelete(a)} />}
          />
        ))}
        <ListRow icon={Plus} iconTone="accent" title={t('verify:attempts.log')} onPress={() => setOpen(true)} testID="log-attempt" />
      </ListGroup>

      {unreachable.unreachable ? (
        <Card>
          <Txt accessibilityRole="header" variant="bodyStrong">{t('verify:attempts.markedTitle')}</Txt>
          <Hint>{t('verify:attempts.markedBody')}</Hint>
          <Button label={t('verify:attempts.undoUnreachable')} variant="secondary" block onPress={onClearUnreachable} />
        </Card>
      ) : unreachable.canMark ? (
        <Card>
          <Txt accessibilityRole="header" variant="bodyStrong">
            {t('verify:attempts.unreachableHint', { count: unreachable.failedCount, methods: unreachable.methodCount })}
          </Txt>
          <Hint>{t('verify:attempts.unreachableBody')}</Hint>
          <Button label={t('verify:attempts.markUnreachable')} variant="secondary" block onPress={onMarkUnreachable} testID="mark-unreachable" />
        </Card>
      ) : null}

      <LogAttemptSheet
        visible={open}
        now={now}
        onClose={() => setOpen(false)}
        onSave={(input) => {
          onLog(input);
          haptics.success();
          setOpen(false);
        }}
      />
      <ConfirmDialog
        visible={!!toDelete}
        title={t('verify:attempts.deleteTitle')}
        confirmLabel={t('verify:attempts.delete')}
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) onDelete(toDelete.id);
          setToDelete(null);
        }}
      />
    </>
  );
}

function LogAttemptSheet({ visible, now, onClose, onSave }: { visible: boolean; now: Date; onClose: () => void; onSave: (a: AttemptInput) => void }) {
  const today = localDate(now);
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<AttemptMethod | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const reset = () => {
    setDay(today);
    setMethod(null);
    setResult(null);
  };
  const dirty = method !== null || result !== null || day !== today;
  return (
    <Sheet
      visible={visible}
      title={t('verify:attempts.log')}
      dirty={dirty}
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <Button
          label={t('common:actions.save')}
          block
          disabled={!method || !result}
          onPress={() => {
            if (!method || !result) return;
            onSave({ at: attemptAt(day, now), method, result });
            reset();
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <DateField label={t('verify:attempts.when')} value={day} onChange={setDay} maximumDate={today} help={t('verify:attempts.whenHelp')} />
        <FieldShell label={t('verify:attempts.how')}>
          <ChoicePills
            options={ATTEMPT_METHODS.map((m) => ({ value: m, label: t(`verify:attempts.method.${m}`) }))}
            value={method}
            onChange={setMethod}
            accessibilityLabel={t('verify:attempts.how')}
          />
        </FieldShell>
        <FieldShell label={t('verify:attempts.result.label')}>
          <ChoicePills
            options={ATTEMPT_RESULTS.map((r) => ({ value: r, label: resultLabel(method ?? 'call', r) }))}
            value={result}
            onChange={setResult}
            accessibilityLabel={t('verify:attempts.result.label')}
          />
        </FieldShell>
      </View>
    </Sheet>
  );
}
