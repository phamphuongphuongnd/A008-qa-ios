/**
 * S-25 Guide — tab 2 (product.md S-25, mockup v2 "S-25 Guide"): search by title · list of short articles.
 */
import { SearchX } from 'lucide-react-native';
import { useState } from 'react';

import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { EmptyState, LargeTitle, ListGroup, ListRow, Screen } from '@/ui';

import { searchArticles } from '../articles';
import { SearchBox } from '../components/SearchBox';

export default function GuideScreen() {
  const [query, setQuery] = useState('');
  const list = searchArticles(query);
  return (
    <Screen header={<LargeTitle title={t('guide:s25.title')} />} bottomInset={false} scrollProps={{ keyboardDismissMode: 'on-drag' }}>
      <SearchBox value={query} onChange={setQuery} />
      {list.length ? (
        <ListGroup>
          {list.map((a) => (
            <ListRow key={a.slug} title={a.title} chevron onPress={() => router.push(routes.guideArticle(a.slug))} />
          ))}
        </ListGroup>
      ) : (
        <EmptyState icon={SearchX} title={t('guide:s25.noResults', { query: query.trim() })} />
      )}
    </Screen>
  );
}
