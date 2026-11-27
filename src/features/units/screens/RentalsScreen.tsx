/** S-02 Rentals (tab 1) — product.md §5 S-02, mockup v2 "Rentals". */
import { House, KeyRound, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { routes } from '@/routes';
import { router } from '@/services/router';
import { useClock } from '@/services/clock';
import { t } from '@/i18n';
import { Banner, ConfirmDialog, EmptyState, IconButton, LargeTitle, Screen, Segmented, showSnackbar } from '@/ui';

import { SwipeRentalCard } from '../components/SwipeRentalCard';
import { useBackupReminder } from '@/backup';

import { useCleanupReminder, useRentalActions, useRentals } from '../hooks';
import { backupReminderText, rentalsView, type SwipeAction } from '../screenModels';

type Filter = 'open' | 'closed';

export default function RentalsScreen() {
  const [filter, setFilter] = useState<Filter>('open');
  const { cards, counts } = useRentals(filter);
  // B-59: reminder cards are recomputed each minute and when the app comes back to the foreground.
  const now = useClock();
  const backup = useBackupReminder(now);
  const cleanup = useCleanupReminder(now);
  const actions = useRentalActions();
  const [deleting, setDeleting] = useState<{ id: number; title: string; message: string } | null>(null);
  const [closing, setClosing] = useState<{ id: number; title: string; message: string } | null>(null);
  const view = rentalsView(filter, counts);

  const close = (id: number) => {
    const stopped = actions.close(id);
    showSnackbar({ message: t('units:s02.closedSnack'), actionLabel: t('common:actions.undo'), onAction: () => actions.reopen(id, stopped) });
  };

  const onAction = (id: number, a: SwipeAction) => {
    if (a === 'close') {
      // B-61: an offer out / a running First-come clock → ask first (closing stops the clocks and their reminders).
      const warning = actions.closeWarning(id);
      if (warning) setClosing({ id, ...warning });
      else close(id);
    } else if (a === 'reopen') {
      actions.reopen(id);
      showSnackbar({ message: t('units:s02.reopenedSnack') });
    } else {
      setDeleting({ id, ...actions.deleteMessage(id) });
    }
  };

  const openSample = () => router.push(routes.rentalHub(actions.openSample()));

  return (
    <Screen
      header={
        <LargeTitle
          title={t('units:s02.title')}
          right={
            <IconButton icon={Plus} tone="filled" accessibilityLabel={t('units:s02.addA11y')} onPress={() => router.push(routes.rentalNew())} />
          }
        />
      }
    >
      {backup.show ? (
        <Banner
          tone="warn"
          actions={[
            { label: t('units:s02.reminders.backupAction'), onPress: () => router.push(routes.backup()) },
            { label: t('units:s02.reminders.later'), onPress: backup.later },
          ]}
        >
          {backupReminderText(backup)}
        </Banner>
      ) : null}
      {cleanup.count > 0 ? (
        <Banner
          tone="info"
          actions={[
            { label: t('units:s02.reminders.cleanupAction'), onPress: () => router.push(routes.dataCleanup()) },
            { label: t('units:s02.reminders.later'), onPress: cleanup.later },
          ]}
        >
          {t('units:s02.reminders.cleanup', { count: cleanup.count })}
        </Banner>
      ) : null}

      {view === 'empty_all' ? (
        <EmptyState
          icon={KeyRound}
          title={t('units:s02.empty.title')}
          body={t('units:s02.empty.body')}
          primary={{ label: t('units:s02.empty.action'), icon: Plus, onPress: () => router.push(routes.rentalNew()) }}
          secondary={{ label: t('units:s02.empty.sample'), onPress: openSample }}
        />
      ) : (
        <>
          <Segmented
            options={[
              { value: 'open', label: t('units:s02.filter.open') },
              { value: 'closed', label: t('units:s02.filter.closed') },
            ]}
            value={filter}
            onChange={setFilter}
            accessibilityLabel={t('units:s02.filterA11y')}
          />
          {view === 'empty_open' ? (
            <EmptyState
              icon={House}
              title={t('units:s02.emptyOpen.title')}
              body={t('units:s02.emptyOpen.body')}
              primary={{ label: t('units:s02.empty.action'), icon: Plus, onPress: () => router.push(routes.rentalNew()) }}
            />
          ) : view === 'empty_closed' ? (
            <EmptyState icon={House} title={t('units:s02.emptyClosed.title')} body={t('units:s02.emptyClosed.body')} />
          ) : (
            <View style={{ gap: 12 }}>
              {cards.map((c) => (
                <SwipeRentalCard
                  key={c.id}
                  card={c}
                  onPress={() => router.push(routes.rentalHub(c.id))}
                  onAction={(a) => onAction(c.id, a)}
                />
              ))}
            </View>
          )}
        </>
      )}

      <ConfirmDialog
        visible={!!closing}
        tone="warn"
        title={closing?.title ?? ''}
        body={closing?.message}
        confirmLabel={t('units:s06.closeDialog.confirm')}
        onCancel={() => setClosing(null)}
        onConfirm={() => {
          if (closing) close(closing.id);
          setClosing(null);
        }}
      />
      <ConfirmDialog
        visible={!!deleting}
        title={deleting?.title ?? ''}
        body={deleting?.message}
        confirmLabel={t('units:s06.deleteDialog.confirm')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.remove(deleting.id);
          setDeleting(null);
          showSnackbar({ message: t('units:s02.deletedSnack') });
        }}
      />
    </Screen>
  );
}
