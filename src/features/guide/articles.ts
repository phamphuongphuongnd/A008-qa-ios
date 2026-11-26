/**
 * S-25 Guide: short articles (≤ 400 words, each with Sources; the screen adds "Not legal advice"). Text lives in
 * src/i18n/en/guide.json (`articles`), read for the current language. Other screens link straight to an article:
 * `routes.guideArticle(GUIDE.adverseAction)`.
 */
import i18n from '@/i18n';

/** Slugs in list order (product.md S-25). */
export const GUIDE = {
  howItWorks: 'how-it-works',
  fairCriteria: 'fair-criteria',
  fairHousing: 'fair-housing-basics',
  vouchers: 'vouchers-income',
  fakeReferences: 'fake-references',
  verifyingIncome: 'verifying-income',
  screeningReports: 'screening-reports',
  adverseAction: 'adverse-action',
  firstCome: 'first-come-seattle',
  criminalHistory: 'criminal-history',
  disposingData: 'disposing-data',
} as const;
export type GuideSlug = (typeof GUIDE)[keyof typeof GUIDE];
export const GUIDE_ORDER: readonly GuideSlug[] = Object.values(GUIDE);

export interface GuideSource {
  label: string;
  url: string;
}

export interface GuideArticle {
  slug: GuideSlug;
  title: string;
  summary: string;
  /** Paragraphs. */
  body: string[];
  sources: GuideSource[];
  words: number;
  /** Reading time at ~200 words a minute (at least 1). */
  minutes: number;
}

type Raw = Record<string, { title: string; summary: string; body: string[]; sources: GuideSource[] }>;

function raw(): Raw {
  const bundle = (i18n.getResourceBundle(i18n.language, 'guide') ?? i18n.getResourceBundle('en', 'guide')) as { articles: Raw };
  return bundle.articles;
}

export const countWords = (text: string) => text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

export function isGuideSlug(s: string): s is GuideSlug {
  return (GUIDE_ORDER as readonly string[]).includes(s);
}

export function getArticle(slug: string): GuideArticle | null {
  if (!isGuideSlug(slug)) return null;
  const a = raw()[slug];
  if (!a) return null;
  const words = countWords([a.title, ...a.body].join(' '));
  return { slug, title: a.title, summary: a.summary, body: a.body, sources: a.sources, words, minutes: Math.max(1, Math.round(words / 200)) };
}

export function listArticles(): GuideArticle[] {
  return GUIDE_ORDER.map(getArticle).filter((a): a is GuideArticle => a != null);
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** S-25 search by title (every word typed must appear in the title, any order, case / accents ignored). */
export function searchArticles(query: string): GuideArticle[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const all = listArticles();
  if (!words.length) return all;
  return all.filter((a) => {
    const title = fold(a.title);
    return words.every((w) => title.includes(w));
  });
}
