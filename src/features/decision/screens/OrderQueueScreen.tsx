/**
 * S-18 Order queue (F-12, First-come mode) — product.md §5 S-18, mockup v2 "Order queue". One applicant at a time in
 * the order received: 72 h "Request missing info" clock, "Move to next" (Incomplete), 48 h offer clock; an expired
 * offer leaves only "Offer expired — move to next". Opening the screen syncs the queue (front applicant → In review).
 */
import { useLocalSearchParams } from 'expo-router';
import { Columns2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db';
import { GUIDE } from '@/features/guide/articles';
import { GuideLink } from '@/features/guide/components/GuideLink';
import { t } from '@/i18n';
import { syncTimers } from '@/notifications';
import { routes } from '@/routes';
import { router } from '@/services/router';
import {
  AppBar,
  Button,
  Card,
  ChoicePills,
  ConfirmDialog,
  EmptyState,
  QueueNumber,
  Screen,
  SectionHeader,
  Sheet,
  TimerChip,
  Txt,
  haptics,
  showSnackbar,
} from '@/ui';

import { expireOffer, moveToNextIncomplete, requestMissingInfo, syncQueueStatus, type MissingInfoMethod } from '../decision';
import { decisionDeps } from '../deps';
import { useOrderQueue } from '../hooks';
import type { QueueRow } from '../review';
import { localIso } from '../time';
import { MISSING_INFO_METHODS, missingInfoSheet, queueRowView } from '../viewModel';
import { Hint, idParam, NotFoundScreen } from '../components/DecisionParts';

type Confirm = { kind: 'move' | 'expired'; row: QueueRow } | null;

export default function OrderQueueScreen() {
  const p = useLocalSearchParams<{ id: string }>();
  const rentalId = idParam(p.id);
  useEffect(() => {
    if (rentalId != null) syncQueueStatus(db, rentalId, localIso());
    // B-58: clocks started while notifications were off get them as soon as they are allowed.
    void syncTimers();
  }, [rentalId]);
  const data = useOrderQueue(rentalId);
  const [missingFor, setMissingFor] = useState<QueueRow | null>(null);
  const [method, setMethod] = useState<MissingInfoMethod | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <NotFoundScreen title={t('decision:s18.title')} />;
  const header = <AppBar title={t('decision:s18.title')} subtitle={data.address.short} />;

  if (data.rentalRow.reviewMode !== 'first_come') {
    return (
      <Screen header={header}>
        <EmptyState
          icon={Columns2}
          title={t('decision:s18.compareMode')}
          primary={{ label: t('decision:s17.title'), onPress: () => router.replace(routes.compare(data.rentalRow.id)) }}
        />
      </Screen>
    );
  }

  const run = async (fn: () => Promise<{ ok: boolean; message?: string } & object>, done?: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) {
        haptics.error();
        showSnackbar({ message: (r as { message: string }).message });
        return false;
      }
      haptics.success();
      if (done) showSnackbar({ message: done });
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onAction = (row: QueueRow, action: string) => {
    if (action === 'review') router.push(routes.applicant(row.rowId));
    else if (action === 'request_missing_info') {
      setMethod(null);
      setMissingFor(row);
    } else if (action === 'move_to_next_incomplete') setConfirm({ kind: 'move', row });
    else if (action === 'offer_expired_move_next') setConfirm({ kind: 'expired', row });
  };

  const sheet = missingFor ? missingInfoSheet(missingFor, new Date()) : null;

  return (
    <Screen header={header}>
      <Hint>{t('decision:s18.intro')}</Hint>
      <GuideLink slug={GUIDE.firstCome} />
      {data.rows.length === 0 ? <EmptyState icon={Columns2} title={t('decision:s18.empty')} /> : null}
      {data.rows.map((row) => {
        const v = queueRowView(row, data.currentId);
        return (
          <Card key={v.key} onPress={() => router.push(routes.applicant(v.rowId))} accessibilityLabel={v.a11y}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <QueueNumber n={v.n} active={v.active} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Txt variant="bodyStrong">{v.name}</Txt>
                <Txt variant="caption" color="inkMuted">
                  {v.line}
                </Txt>
                {v.timer ? <TimerChip label={v.timer.label} calm={v.timer.calm} /> : null}
                {v.buttons.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {v.buttons.map((b) => (
                      <Button key={b.action} size="sm" label={b.label} variant={b.variant} onPress={() => onAction(row, b.action)} />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        );
      })}

      <Sheet
        visible={!!missingFor}
        onClose={() => setMissingFor(null)}
        title={t('decision:s18.requestMissing')}
        footer={
          <Button
            label={t('decision:s18.start')}
            block
            disabled={!method}
            loading={busy}
            onPress={async () => {
              const row = missingFor!;
              let permission: string | null = null;
              const ok = await run(async () => {
                const r = await requestMissingInfo(decisionDeps, row.rowId, method!);
                if (r.ok) permission = r.permission;
                return r;
              }, t('decision:s18.started'));
              if (ok) {
                setMissingFor(null);
                if (permission !== 'granted') showSnackbar({ message: t('decision:s18.notificationsOff') });
              }
            }}
          />
        }
      >
        {sheet ? (
          <View style={{ gap: 12 }}>
            <View>
              <Txt variant="bodyStrong">{t('decision:s18.hours')}</Txt>
              <Txt color="inkMuted">{sheet.endsText}</Txt>
            </View>
            {sheet.missing.length ? (
              <View>
                <SectionHeader title={t('decision:s18.missing')} />
                {sheet.missing.map((m) => (
                  <Txt key={m}>• {m}</Txt>
                ))}
              </View>
            ) : null}
            <SectionHeader title={t('decision:s18.howTold')} />
            <ChoicePills
              options={MISSING_INFO_METHODS.map((m) => ({ value: m, label: t(`decision:s18.method.${m}`) }))}
              value={method}
              onChange={setMethod}
              accessibilityLabel={t('decision:s18.howTold')}
            />
            <Hint>{t('decision:s18.reminder')}</Hint>
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={!!confirm}
        tone="warn"
        title={t(confirm?.kind === 'expired' ? 'decision:s18.expiredConfirm.title' : 'decision:s18.moveConfirm.title')}
        body={t(confirm?.kind === 'expired' ? 'decision:s18.expiredConfirm.body' : 'decision:s18.moveConfirm.body', { name: confirm?.row.fullName ?? '' })}
        confirmLabel={t('decision:s18.moveConfirm.confirm')}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm!;
          await run(() => (c.kind === 'expired' ? expireOffer(decisionDeps, c.row.rowId) : moveToNextIncomplete(decisionDeps, c.row.rowId)));
          setConfirm(null);
        }}
      />
    </Screen>
  );
}
