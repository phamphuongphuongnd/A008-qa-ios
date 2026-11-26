/**
 * S-17 Compare (F-12, Compare mode) — product.md §5 S-17, mockup v2 "Compare". Columns in the order received (never
 * sorted), first column pinned, last row "Issues"; no ranking, no count of Met. From 130 % text the table becomes one
 * card per applicant (`useCompareAsCards`). Tapping a name below opens S-09.
 */
import { useLocalSearchParams } from 'expo-router';
import { Columns2, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { AppBar, CompareTable, EmptyState, ListGroup, ListRow, Screen, SwitchRow, useCompareAsCards } from '@/ui';

import { useCompare } from '../hooks';
import { compareView } from '../viewModel';
import { Hint, idParam, NotFoundScreen } from '../components/DecisionParts';

export default function CompareScreen() {
  const p = useLocalSearchParams<{ id: string }>();
  const [hide, setHide] = useState(false);
  const data = useCompare(idParam(p.id), hide);
  const cards = useCompareAsCards();
  if (!data) return <NotFoundScreen title={t('decision:s17.title')} />;
  const view = compareView(data);

  return (
    <Screen header={<AppBar title={t('decision:s17.title')} subtitle={data.address.short} />}>
      <Hint>{t('decision:s17.notRanking')}</Hint>
      {view.state !== 'empty' ? (
        <ListGroup>
          <SwitchRow title={t('decision:s17.hideClosed')} value={hide} onChange={setHide} />
        </ListGroup>
      ) : null}

      {view.state === 'empty' ? (
        <EmptyState
          icon={Columns2}
          title={t('decision:s17.emptyTitle')}
          body={t('decision:s17.emptyBody')}
          primary={{ label: t('common:actions.back'), onPress: () => router.back() }}
        />
      ) : view.state === 'all_hidden' ? (
        <EmptyState icon={EyeOff} title={t('decision:s17.allHidden')} />
      ) : (
        <>
          <CompareTable columns={view.columns} rows={view.rows} cornerLabel={t('decision:s17.corner')} cards={cards} />
          <View>
            <ListGroup>
              {data.bundles.map((b) => (
                <ListRow
                  key={b.applicant.id}
                  title={b.applicant.fullName}
                  chevron
                  onPress={() => router.push(routes.applicant(b.applicant.id))}
                />
              ))}
            </ListGroup>
          </View>
        </>
      )}
    </Screen>
  );
}
