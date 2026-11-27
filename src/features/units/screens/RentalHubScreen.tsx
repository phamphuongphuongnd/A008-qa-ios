/** S-06 Rental hub — product.md §5 S-06, mockup v2 "Rental hub" (Compare / First-come, empty). */
import { router, useLocalSearchParams } from 'expo-router';
import { ClipboardCheck, Columns2, FileQuestion, ListOrdered, MoreHorizontal, Share2, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { parseId, routes } from '@/routes';
import { t } from '@/i18n';
import {
  AppBar,
  ApplicantRow,
  Banner,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Hero,
  IconButton,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  showSnackbar,
} from '@/ui';
import { sharePublishedCriteria } from '@/features/criteria/hooks';

import { applicantStatusLabel, receivedText } from '../format';
import { useRentalActions, useRentalHub } from '../hooks';
import { hubMenuItems, hubReviewButton, statusTone, type HubMenuKey } from '../screenModels';

export default function RentalHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rentalId = parseId(id) ?? -1;
  const hub = useRentalHub(rentalId);
  const actions = useRentalActions();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<null | 'close' | 'delete'>(null);
  const [sharing, setSharing] = useState(false);

  if (!hub) {
    return (
      <Screen header={<AppBar />}>
        <EmptyState icon={FileQuestion} title={t('units:s06.notFound')} primary={{ label: t('common:notFound.goHome'), onPress: () => router.replace(routes.rentals()) }} />
      </Screen>
    );
  }

  const review = hubReviewButton(hub);
  const shareCriteria = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await sharePublishedCriteria(rentalId);
    } catch {
      showSnackbar({ message: t('units:s05.pdfError') });
    } finally {
      setSharing(false);
    }
  };

  const onMenu = (key: HubMenuKey) => {
    setMenu(false);
    switch (key) {
      case 'editRental':
        return router.push(routes.rentalEdit(rentalId));
      case 'editCriteria':
        return router.push(routes.criteria(rentalId));
      case 'published':
        return router.push(routes.publishedCriteria(rentalId));
      case 'decisionFile':
        return router.push(routes.decisionFile(rentalId));
      case 'closeRental':
        return setDialog('close');
      case 'reopenRental':
        actions.reopen(rentalId);
        return showSnackbar({ message: t('units:s02.reopenedSnack') });
      case 'deleteRental':
        return setDialog('delete');
    }
  };
  const del = dialog === 'delete' ? actions.deleteMessage(rentalId) : null;
  // B-61: say what closing stops (an offer out / running First-come clocks).
  const closeWarn = dialog === 'close' ? actions.closeWarning(rentalId) : null;

  return (
    <Screen
      header={
        <AppBar
          right={<IconButton icon={MoreHorizontal} accessibilityLabel={t('units:s06.menuA11y')} onPress={() => setMenu(true)} />}
        />
      }
    >
      <Hero title={hub.address} meta={hub.line}>
        <Chip label={hub.modeChip} tone="outline" icon={hub.reviewMode === 'compare' ? Columns2 : ListOrdered} />
        <Chip label={hub.statusLabel} tone={statusTone(hub.status)} dot={hub.status !== 'closed'} />
      </Hero>

      {hub.moveInApplicantId !== null ? (
        <ListGroup>
          <ListRow
            icon={ClipboardCheck}
            iconTone="accent"
            title={t('units:s06.moveIn')}
            onPress={() => router.push(routes.moveIn(rentalId, hub.moveInApplicantId!))}
          />
        </ListGroup>
      ) : null}
      {hub.pendingNoticeCount > 0 ? <Banner tone="warn">{t('units:s06.pendingNotices', { count: hub.pendingNoticeCount })}</Banner> : null}

      {hub.applicants.length === 0 && hub.deletedCount > 0 ? (
        // B-62: every applicant's data was deleted (S-24) — not "No applicants yet".
        <EmptyState
          icon={Users}
          title={t('units:s06.empty.deletedTitle')}
          body={t('units:s06.empty.deletedBody', { count: hub.deletedCount })}
          style={{ paddingTop: 28 }}
        />
      ) : hub.applicants.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('units:s06.empty.title')}
          body={t('units:s06.empty.body')}
          primary={{ label: t('units:s06.empty.add'), icon: UserPlus, onPress: () => router.push(routes.addApplicant(rentalId)) }}
          secondary={{ label: t('units:s06.empty.share'), onPress: shareCriteria }}
          style={{ paddingTop: 28 }}
        />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Button block icon={UserPlus} label={t('units:s06.addApplicant')} onPress={() => router.push(routes.addApplicant(rentalId))} />
            {review ? (
              <Button
                block
                variant="tonal"
                icon={review.kind === 'compare' ? Columns2 : ListOrdered}
                label={review.label}
                onPress={() => router.push(review.kind === 'compare' ? routes.compare(rentalId) : routes.orderQueue(rentalId))}
              />
            ) : null}
          </View>
          <View>
            <SectionHeader title={t('units:s06.applicants')} meta={t('units:s06.sortedByReceived')} />
            <ListGroup>
              {hub.applicants.map((a) => (
                <ApplicantRow
                  key={a.id}
                  name={a.fullName}
                  status={applicantStatusLabel(a.status)}
                  received={t('units:s06.received', { when: receivedText(a.receivedAt) })}
                  summary={a.summaryText}
                  summaryReady={a.ready}
                  queue={a.queueNumber !== null ? { n: a.queueNumber, active: a.status === 'in_review' } : undefined}
                  onPress={() => router.push(routes.applicant(a.id))}
                />
              ))}
            </ListGroup>
          </View>
        </>
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <ListGroup>
          {hubMenuItems(hub.status).map((m) => (
            <ListRow
              key={m.key}
              title={m.label}
              danger={m.danger}
              icon={m.key === 'published' ? Share2 : undefined}
              onPress={() => onMenu(m.key)}
            />
          ))}
        </ListGroup>
      </Sheet>
      <ConfirmDialog
        visible={dialog === 'close'}
        tone="warn"
        title={t('units:s06.closeDialog.title')}
        body={closeWarn?.message ?? t('units:s06.closeDialog.body')}
        confirmLabel={t('units:s06.closeDialog.confirm')}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          const stopped = actions.close(rentalId);
          showSnackbar({ message: t('units:s02.closedSnack'), actionLabel: t('common:actions.undo'), onAction: () => actions.reopen(rentalId, stopped) });
        }}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        title={del?.title ?? ''}
        body={del?.message}
        confirmLabel={t('units:s06.deleteDialog.confirm')}
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          actions.remove(rentalId);
          showSnackbar({ message: t('units:s02.deletedSnack') });
          router.back();
        }}
      />
    </Screen>
  );
}
