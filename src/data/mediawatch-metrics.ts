// Pure selectors over the MediaWatch news-article dataset. Nothing here reads
// socialMentions — the two workspaces stay independent. Publishers and Authors
// are aggregations of newsArticles (web parity: buildPublishers/buildAuthors),
// with score = avg Story Value × 2.
import { bucketsForCategory } from './taxonomy';
import type { Sentiment } from './types';
import type { EntityStat, MediaChannel, MediaType, NewsArticle } from './mediawatch-types';

// ── Formatting ──

/** 397900 → "PHP 397.9K"; 1_400_000 → "PHP 1.4M". */
export function formatAve(n: number): string {
  if (n >= 1_000_000) return `PHP ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `PHP ${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `PHP ${Math.round(n)}`;
}

/** 397900 → "398K" (compact, no currency) — for tight table cells. */
export function compactAve(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

/** "PHP 397.9K" → 397900. Tolerant of the compact forms above. */
export function parseAve(s: string): number {
  const m = s.replace(/php|,|\s/gi, '').match(/^([\d.]+)([km]?)$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  return unit === 'm' ? n * 1_000_000 : unit === 'k' ? n * 1_000 : n;
}

/** 47966282 → "48.0M" style compact count (reach/impressions). */
export function compactCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

// ── Channels ──

const CHANNEL_OF: Record<MediaType, MediaChannel> = {
  online: 'Online',
  blog: 'Online',
  tv: 'TV',
  radio: 'Radio',
  broadsheet: 'Print',
  provincial: 'Print',
  tabloid: 'Print',
  magazine: 'Print',
};

export function mediaChannel(t: MediaType): MediaChannel {
  return CHANNEL_OF[t];
}

// ── Date helpers ──

function dateValue(a: NewsArticle): number {
  const d = new Date(a.date).getTime();
  return Number.isNaN(d) ? 0 : d;
}

export function sortByNewest(a: NewsArticle, b: NewsArticle): number {
  return dateValue(b) - dateValue(a);
}

/** Heuristic "published today" test from the relative `ago` string. */
export function isToday(a: NewsArticle): boolean {
  return /\b(\d+\s*h|hour|min|just now|today)\b/i.test(a.ago);
}

// ── Aggregations ──

function buildEntityStats(articles: NewsArticle[], key: (a: NewsArticle) => string): EntityStat[] {
  const groups = new Map<string, NewsArticle[]>();
  for (const a of articles) {
    const k = key(a);
    if (!k) continue;
    const arr = groups.get(k);
    if (arr) arr.push(a);
    else groups.set(k, [a]);
  }
  const out: EntityStat[] = [];
  groups.forEach((items, name) => {
    const totalSV = items.reduce((s, a) => s + a.storyValue, 0);
    const totalAve = items.reduce((s, a) => s + a.ave, 0);
    const split = { positive: 0, neutral: 0, negative: 0 };
    items.forEach((a) => (split[a.sentiment] += 1));
    out.push({
      name,
      count: items.length,
      totalSV,
      totalAve,
      // Web reference: Pub/Author Score = avg Story Value × 2.
      score: +((totalSV / items.length) * 2).toFixed(2),
      sentimentSplit: split,
      articles: [...items].sort(sortByNewest),
    });
  });
  return out;
}

export function buildPublishers(articles: NewsArticle[]): EntityStat[] {
  return buildEntityStats(articles, (a) => a.outlet).sort((a, b) => b.score - a.score);
}

export function buildAuthors(articles: NewsArticle[]): EntityStat[] {
  return buildEntityStats(articles, (a) => a.author).sort((a, b) => b.score - a.score);
}

// ── Filtering (Mentions feed) ──

export type ArticleSort = 'newest' | 'oldest' | 'value-high' | 'value-low';

export interface ArticleFilters {
  category: string;
  /** Empty set = all media types. */
  mediaTypes: Set<MediaType>;
  /** Bucket names selected in the filter sheet; empty = all. */
  topics: Set<string>;
  sentiments: Set<Sentiment>;
  storyValueRange: { min: number; max: number };
  dateRange: { start: Date | null; end: Date | null };
  sort: ArticleSort;
}

// The media types that roll up under each coarse channel — used by the filter
// sheet's single-select channel pills.
export const CHANNEL_TYPES: Record<MediaChannel, MediaType[]> = {
  Online: ['online', 'blog'],
  TV: ['tv'],
  Radio: ['radio'],
  Print: ['broadsheet', 'provincial', 'tabloid', 'magazine'],
};

export function defaultArticleFilters(category: string): ArticleFilters {
  // Default to the last 7 days up to today (see FeedCoverageBar / the feed).
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 7);
  return {
    category,
    mediaTypes: new Set(),
    topics: new Set(),
    sentiments: new Set(),
    storyValueRange: { min: 0, max: 10 },
    dateRange: { start, end },
    sort: 'newest',
  };
}

// Anything diverging from the defaults counts as an active filter (drives the
// header filter-icon dot). `category` is excluded — it has its own dropdown.
// The date window is excluded too: the feed defaults to a 7-day range, so it's a
// standing scope rather than an ad-hoc filter.
export function hasActiveArticleFilters(f: ArticleFilters): boolean {
  return (
    f.mediaTypes.size > 0 ||
    f.topics.size > 0 ||
    f.sentiments.size > 0 ||
    f.storyValueRange.min > 0 ||
    f.storyValueRange.max < 10 ||
    f.sort !== 'newest'
  );
}

export function filterArticles(articles: NewsArticle[], f: ArticleFilters): NewsArticle[] {
  const categoryBuckets = new Set(bucketsForCategory(f.category));
  const result = articles.filter((a) => {
    if (categoryBuckets.size > 0 && !a.entities.some((e) => categoryBuckets.has(e))) return false;
    if (f.topics.size > 0 && !a.entities.some((e) => f.topics.has(e))) return false;
    if (f.mediaTypes.size > 0 && !f.mediaTypes.has(a.mediaType)) return false;
    if (f.sentiments.size > 0 && !f.sentiments.has(a.sentiment)) return false;
    if (a.storyValue < f.storyValueRange.min || a.storyValue > f.storyValueRange.max) return false;
    const { start, end } = f.dateRange;
    if (start || end) {
      const d = new Date(a.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
    }
    return true;
  });
  return result.sort((a, b) => {
    switch (f.sort) {
      case 'oldest':
        return dateValue(a) - dateValue(b);
      case 'value-high':
        return b.storyValue - a.storyValue;
      case 'value-low':
        return a.storyValue - b.storyValue;
      case 'newest':
      default:
        return dateValue(b) - dateValue(a);
    }
  });
}

// ── Today's Brief stats ──

export interface ArticleBriefStats {
  total: number;
  todayCount: number;
  combinedAve: number;
  sentimentSplit: { positive: number; neutral: number; negative: number }; // percentages 0–100
  dominantSentiment: Sentiment;
  tier1Count: number;
  topOutlet: string;
}

export function deriveArticleBriefStats(articles: NewsArticle[]): ArticleBriefStats {
  const total = articles.length || 1;
  const counts = { positive: 0, neutral: 0, negative: 0 };
  articles.forEach((a) => (counts[a.sentiment] += 1));
  const pct = (n: number) => Math.round((n / total) * 100);
  const sentimentSplit = {
    positive: pct(counts.positive),
    neutral: pct(counts.neutral),
    negative: pct(counts.negative),
  };
  const dominantSentiment = (Object.keys(counts) as Sentiment[]).reduce((a, b) =>
    counts[a] >= counts[b] ? a : b,
  );
  const publishers = buildPublishers(articles);
  const topByCount = [...publishers].sort((a, b) => b.count - a.count)[0];
  return {
    total: articles.length,
    todayCount: articles.filter(isToday).length,
    combinedAve: articles.reduce((s, a) => s + a.ave, 0),
    sentimentSplit,
    dominantSentiment,
    tier1Count: articles.filter((a) => a.storyValue >= 7).length,
    topOutlet: topByCount ? topByCount.name : '—',
  };
}

// Members of a trending-story cluster = articles tagged with any of its
// entities (web parity: clustering by shared entities). Used by the Brief.
export function articlesForEntities(articles: NewsArticle[], entities: string[]): NewsArticle[] {
  const set = new Set(entities);
  return articles.filter((a) => a.entities.some((e) => set.has(e))).sort(sortByNewest);
}

// ── Keyword cloud (Activity Tracker) ──
// Article-native: aggregate the matched articles' own keywords + entities into a
// frequency-ranked cloud, each term drilling to the articles that carry it.
export interface ArticleKeyword {
  term: string;
  count: number;
  articles: NewsArticle[];
}

function titleCaseTerm(t: string): string {
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeArticleKeywords(articles: NewsArticle[]): ArticleKeyword[] {
  const map = new Map<string, { count: number; set: Set<NewsArticle> }>();
  const bump = (term: string, a: NewsArticle, inc: number) => {
    const key = term.trim();
    if (key.length < 2) return;
    const e = map.get(key) ?? { count: 0, set: new Set<NewsArticle>() };
    e.count += inc;
    e.set.add(a);
    map.set(key, e);
  };
  for (const a of articles) {
    a.keywords.forEach(([t, c]) => bump(titleCaseTerm(t), a, c));
    a.entities.forEach((e) => bump(e, a, 1));
  }
  return [...map.entries()]
    .map(([term, v]) => ({ term, count: v.count, articles: [...v.set] }))
    .sort((x, y) => y.count - x.count || x.term.localeCompare(y.term))
    .slice(0, 24);
}
