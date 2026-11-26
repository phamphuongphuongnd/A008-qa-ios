/**
 * Small text link from a screen to the Guide article that explains it (product.md S-25 "other screens link straight
 * to the article"). The label is the article's title, so every link reads the same way.
 */
import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { TextButton } from '@/ui';

import { getArticle, type GuideSlug } from '../articles';

export function GuideLink({ slug }: { slug: GuideSlug }) {
  const article = getArticle(slug);
  if (!article) return null;
  return <TextButton label={article.title} accessibilityLabel={`${article.title}. ${t('guide:link.hint')}`} onPress={() => router.push(routes.guideArticle(slug))} />;
}
