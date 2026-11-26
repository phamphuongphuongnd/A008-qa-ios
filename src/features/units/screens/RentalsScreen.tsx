/** S-02 Rentals (tab 1) — product.md §5 S-02, mockup v2 "Rentals". */
// Screen id="S-02" (route table: src/navigation/screens.ts)
import { router } from 'expo-router';
import { House, KeyRound, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { routes } from '@/routes';
import { t } from '@/i18n';
import { Banner, ConfirmDialog, EmptyState, IconButton, LargeTitle, Screen, Segmented, showSnackbar } from '@/ui';

import { SwipeRentalCard } from '../components/SwipeRentalCard';
import { useRentalActions, useRentals, useRentalsReminders } from '../hooks';
import { backupReminderText, rentalsView, type SwipeAction } from '../screenModels';

type Filter = 'open' | 'closed';

export default function RentalsScreen() {
  const [filter, setFilter] = useState<Filter>('open');
  const { cards, counts } = useRentals(filter);
  const reminders = useRentalsReminders();
  const actions = useRentalActions();
  const [deleting, setDeleting] = useState<{ id: number; title: string; message: string } | null>(null);
  const view = rentalsView(filter, counts);

  const onAction = (id: number, a: SwipeAction) => {
    if (a === 'close') {
      actions.close(id);
      showSnackbar({ message: t('units:s02.closedSnack'), actionLabel: t('common:actions.undo'), onAction: () => actions.reopen(id) });
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
      {reminders.backup ? (
        <Banner
          tone="warn"
          actions={[
            { label: t('units:s02.reminders.backupAction'), onPress: () => router.push(routes.backup()) },
            { label: t('units:s02.reminders.later'), onPress: () => reminders.later('backup') },
          ]}
        >
          {backupReminderText(reminders.backup)}
        </Banner>
      ) : null}
      {reminders.cleanupCount > 0 ? (
        <Banner
          tone="info"
          actions={[
            { label: t('units:s02.reminders.cleanupAction'), onPress: () => router.push(routes.dataCleanup()) },
            { label: t('units:s02.reminders.later'), onPress: () => reminders.later('cleanup') },
          ]}
        >
          {t('units:s02.reminders.cleanup', { count: reminders.cleanupCount })}
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
