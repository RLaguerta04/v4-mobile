// MediaWatch Dashboard derivations — the article analogue of
// dashboard-metrics.ts. Produces inputs shaped for the SAME reusable chart
// primitives (KpiGrid / BarLineChart / Donut / Histogram / StackedTimeBar /
// ShareBar / HBarList / EntitiesTreemap), but computed from newsArticles and
// keyed by outlet / author / mediaType / section instead of social platforms.
import type { ShareSegment, HBarItem } from '@/components/dashboard/bars';
import type { EntityTile } from '@/components/dashboard/treemap';
import type { TimelinePoint } from '@/components/dashboard/charts';
import { SENTIMENT_COLOR, SENTIMENT_LABEL, seriesColor } from '@/components/dashboard/palette';
import { KpiCard, stableDelta } from '@/data/dashboard-metrics';
import { buildAuthors, buildPublishers, compactAve, formatAve, mediaChannel } from '@/data/mediawatch-metrics';
import type { MediaChannel, MediaType, NewsArticle } from '@/data/mediawatch-types';
import { bucketsForCategory, CATEGORY_TAXONOMY } from '@/data/taxonomy';
import type { Sentiment } from '@/data/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

export const CHANNEL_COLOR: Record<MediaChannel, string> = {
  Online: '#2563EB',
  TV: '#7C3AED',
  Print: '#4F46E5',
  Radio: '#DB2777',
};

function parseDate(s: string): number {
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function avatarInitial(name: string): string {
  return name.replace(/^[@#]/, '').charAt(0).toUpperCase() || '?';
}

function countBy<T extends string>(articles: NewsArticle[], key: (a: NewsArticle) => T): [T, number][] {
  const map = new Map<T, number>();
  articles.forEach((a) => map.set(key(a), (map.get(key(a)) ?? 0) + 1));
  return [...map.entries()].sort((x, y) => y[1] - x[1]);
}

// ── KPI cards ── (reuses KpiCard; `explore` is unused here — the screen reads `key`)
export function buildArticleKpis(articles: NewsArticle[]): KpiCard[] {
  const cards: KpiCard[] = [];
  const AC = '#E94F37';
  const push = (c: Omit<KpiCard, 'deltaPct' | 'explore'> & { deltaKey?: string }) =>
    cards.push({ ...c, deltaPct: stableDelta(c.deltaKey ?? c.key), explore: 'total' });

  // Total Results — big count + the web's channel breakdown sub-line
  // (Broadcast = TV + Radio, mirroring "Online: 168 · Print: 52 · Broadcast: 28").
  const chCount = (ch: MediaChannel) => articles.filter((a) => mediaChannel(a.mediaType) === ch).length;
  const broadcast = chCount('TV') + chCount('Radio');
  push({
    key: 'total',
    label: 'Total Results',
    value: String(articles.length),
    isNumber: true,
    detail: `Online: ${chCount('Online')} · Print: ${chCount('Print')} · Broadcast: ${broadcast}`,
  });

  const totalAve = articles.reduce((s, a) => s + a.ave, 0);
  push({ key: 'ave', label: 'Total AVE', value: formatAve(totalAve), isNumber: true });

  const pubs = buildPublishers(articles);
  const topPub = [...pubs].sort((a, b) => b.count - a.count)[0];
  if (topPub) {
    push({
      key: `pub:${topPub.name}`,
      label: 'Top Publisher',
      value: topPub.name,
      isNumber: false,
      detail: `${topPub.count} ${topPub.count === 1 ? 'article' : 'articles'}`,
      avatarLetter: avatarInitial(topPub.name),
      avatarColor: AC,
    });
  }

  const authors = buildAuthors(articles);
  const topAuthor = [...authors].sort((a, b) => b.count - a.count)[0];
  if (topAuthor) {
    push({
      key: `author:${topAuthor.name}`,
      label: 'Top Author',
      value: topAuthor.name,
      isNumber: false,
      detail: `${topAuthor.count} ${topAuthor.count === 1 ? 'article' : 'articles'}`,
      avatarLetter: avatarInitial(topAuthor.name),
      avatarColor: '#2563EB',
    });
  }

  // Most Articles in a Day — the busiest publish date (web parity: value
  // "N Article/s", sub = that date).
  const byDay = countBy(articles, (a) => a.date);
  const topDay = byDay[0];
  if (topDay) {
    push({
      key: `day:${topDay[0]}`,
      label: 'Most Articles in a Day',
      value: `${topDay[1]} Article/s`,
      isNumber: true,
      detail: topDay[0],
    });
  }

  const [topChannel] = countBy(articles, (a) => mediaChannel(a.mediaType));
  if (topChannel) {
    push({
      key: `channel:${topChannel[0]}`,
      label: 'Top Exposure by Medium',
      value: topChannel[0],
      isNumber: false,
      detail: `${topChannel[1]} articles`,
      avatarLetter: topChannel[0].charAt(0),
      avatarColor: CHANNEL_COLOR[topChannel[0]],
    });
  }

  const [topSection] = countBy(articles, (a) => a.section);
  if (topSection) {
    push({
      key: `section:${topSection[0]}`,
      label: 'Most Dominant Section',
      value: topSection[0],
      isNumber: false,
      detail: `${topSection[1]} articles`,
      avatarLetter: avatarInitial(topSection[0]),
      avatarColor: '#0D9488',
    });
  }

  const sentCounts = countBy(articles, (a) => a.sentiment);
  const topSent = sentCounts[0];
  if (topSent) {
    push({
      key: `sent:${topSent[0]}`,
      label: 'Top Tonality',
      value: SENTIMENT_LABEL[topSent[0] as Sentiment],
      isNumber: false,
      detail: `${topSent[1]} articles`,
      avatarLetter: SENTIMENT_LABEL[topSent[0] as Sentiment].charAt(0),
      avatarColor: SENTIMENT_COLOR[topSent[0] as Sentiment],
    });
  }

  const entCounts = new Map<string, number>();
  articles.forEach((a) => a.entities.forEach((e) => entCounts.set(e, (entCounts.get(e) ?? 0) + 1)));
  const topEnt = [...entCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEnt) {
    push({
      key: `entity:${topEnt[0]}`,
      label: 'Top Entities',
      value: topEnt[0],
      isNumber: false,
      detail: `${topEnt[1]} articles`,
      avatarLetter: avatarInitial(topEnt[0]),
      avatarColor: '#7C3AED',
    });
  }

  return cards;
}

// ── Timeline: article volume (bars) + total story value (line) over 30 days ──
export function buildArticleTimeline(articles: NewsArticle[]): TimelinePoint[] {
  const times = articles.map((a) => parseDate(a.date)).filter((t) => t > 0);
  const end = times.length ? Math.max(...times) : Date.now();
  const WINDOW = 30;
  const results: number[] = new Array(WINDOW).fill(0);
  const svSum: number[] = new Array(WINDOW).fill(0);
  articles.forEach((a) => {
    const t = parseDate(a.date);
    if (!t) return;
    const idx = WINDOW - 1 - Math.round((end - t) / DAY);
    if (idx >= 0 && idx < WINDOW) {
      results[idx] += 1;
      svSum[idx] += a.storyValue;
    }
  });
  const pts: TimelinePoint[] = [];
  for (let i = 0; i < WINDOW; i++) {
    const d = new Date(end - (WINDOW - 1 - i) * DAY);
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      sum += svSum[k];
      cnt++;
    }
    const proj = cnt ? sum / cnt : 0;
    pts.push({
      date: `${d.getDate()}. ${MONTHS[d.getMonth()]}`,
      results: results[i],
      storyValue: svSum[i],
      projAvg: proj,
      band: [Math.max(0, proj * 0.7), proj * 1.3 + 0.5],
    });
  }
  return pts;
}

// ── Topic Emphasis: Main vs Mention 100%-stacked share ──
// The article model carries no emphasis field (the web's is a hardcoded
// constant), so we derive it: a high-Story-Value pickup treats the brand as
// the MAIN subject; a lower one only MENTIONs it. Threshold chosen so the mix
// skews toward Mention, matching the web's ~87/13 split.
const EMPHASIS_MAIN_MIN = 6;
export function articleEmphasis(a: NewsArticle): 'Main' | 'Mention' {
  return a.storyValue >= EMPHASIS_MAIN_MIN ? 'Main' : 'Mention';
}
export function buildTopicEmphasis(articles: NewsArticle[]): ShareSegment[] {
  const mention = articles.filter((a) => articleEmphasis(a) === 'Mention').length;
  const main = articles.length - mention;
  return [
    { label: 'Mention', value: mention, color: '#5B8DEF' },
    { label: 'Main', value: main, color: '#A8E6C8' },
  ].filter((s) => s.value > 0);
}

// ── Channel summary cards (web parity: #db-channels / channelData) ──
// One card per media TYPE present, with the hero Total AVE + a 2×2 stat block
// (Articles / Pub. Score / Avg Words / Story Value). Avg Words is derived from
// the authored transcript (broadcast) or summary (everything else) — real text,
// not fabricated. Pub. Score uses the web's avg-SV×2 score formula.
export interface ChannelCardStat {
  type: MediaType;
  ave: number;
  articles: number;
  pubScore: number;
  avgWords: number;
  storyValue: number;
}

// Web display order (Online News, Blogs, Broadsheet, Provincial, Tabloid, TV,
// Radio) extended with magazine, which the mobile dataset also carries.
const CHANNEL_CARD_ORDER: MediaType[] = ['online', 'blog', 'broadsheet', 'provincial', 'tabloid', 'magazine', 'tv', 'radio'];

function wordCount(a: NewsArticle): number {
  const text = a.transcript ?? a.summary ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function buildChannelCards(articles: NewsArticle[]): ChannelCardStat[] {
  return CHANNEL_CARD_ORDER.map((type) => {
    const items = articles.filter((a) => a.mediaType === type);
    if (!items.length) return null;
    const totalSV = items.reduce((s, a) => s + a.storyValue, 0);
    const avgSV = totalSV / items.length;
    return {
      type,
      ave: items.reduce((s, a) => s + a.ave, 0),
      articles: items.length,
      pubScore: +(avgSV * 2).toFixed(2),
      avgWords: Math.round(items.reduce((s, a) => s + wordCount(a), 0) / items.length),
      storyValue: +avgSV.toFixed(2),
    };
  }).filter((c): c is ChannelCardStat => c !== null);
}

// ── Media exposure: 100%-stacked share by channel ──
export function buildMediaExposure(articles: NewsArticle[]): ShareSegment[] {
  return (['Online', 'TV', 'Print', 'Radio'] as MediaChannel[])
    .map((ch) => ({ label: ch, value: articles.filter((a) => mediaChannel(a.mediaType) === ch).length, color: CHANNEL_COLOR[ch] }))
    .filter((s) => s.value > 0);
}

// ── Tonality donut ──
export function buildTonalityDonut(articles: NewsArticle[]): { label: string; value: number; color: string }[] {
  return (['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => ({
    label: SENTIMENT_LABEL[s],
    value: articles.filter((a) => a.sentiment === s).length,
    color: SENTIMENT_COLOR[s],
  }));
}

// ── Tonality over time (weekly stacked) ──
export interface TonalityWeek {
  label: string;
  segments: { value: number; color: string }[];
}
export function buildTonalityTimeline(articles: NewsArticle[], limit = 6): TonalityWeek[] {
  const dated = articles.filter((a) => parseDate(a.date) > 0);
  if (!dated.length) return [];
  const g = new Map<number, Record<Sentiment, number>>();
  dated.forEach((a) => {
    const d = new Date(parseDate(a.date));
    const k = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime();
    const e = g.get(k) ?? { positive: 0, neutral: 0, negative: 0 };
    e[a.sentiment] += 1;
    g.set(k, e);
  });
  return [...g.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-limit)
    .map(([k, c]) => {
      const d = new Date(k);
      return {
        label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
        segments: [
          { value: c.positive, color: SENTIMENT_COLOR.positive },
          { value: c.neutral, color: SENTIMENT_COLOR.neutral },
          { value: c.negative, color: SENTIMENT_COLOR.negative },
        ],
      };
    });
}

// ── Story Value histogram (0–10 buckets) ──
export function buildStoryValueHistogram(articles: NewsArticle[]): { label: string; value: number }[] {
  const buckets = new Array(11).fill(0);
  articles.forEach((a) => {
    const b = Math.max(0, Math.min(10, Math.floor(a.storyValue)));
    buckets[b] += 1;
  });
  return buckets.map((value, i) => ({ label: String(i), value }));
}

// ── Top publishers / authors (horizontal bars; value = article count, sub = AVE) ──
export function buildTopPublishers(articles: NewsArticle[], limit = 8): HBarItem[] {
  return buildPublishers(articles)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((p) => ({ label: p.name, value: p.count, sub: compactAve(p.totalAve), color: '#2563EB' }));
}
export function buildTopAuthors(articles: NewsArticle[], limit = 8): HBarItem[] {
  return buildAuthors(articles)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((a) => ({ label: a.name, value: a.count, sub: compactAve(a.totalAve), color: '#7C3AED' }));
}

// ── Publisher Score / Author Story Value distributions (bubble plots) ──
// x = article count, y = avg story value, bubble size ∝ score (avg SV × 2) —
// web parity: PubScoreCard / AuthorBubble. The Bar-tab view reuses the Top
// Publishers / Top Authors horizontal bars (article count).
export interface DistBubble {
  name: string;
  articles: number;
  storyValue: number;
  score: number;
  color: string;
}
export function buildPublisherBubbles(articles: NewsArticle[], limit = 14): DistBubble[] {
  return buildPublishers(articles)
    .slice(0, limit)
    .map((p, i) => ({
      name: p.name,
      articles: p.count,
      storyValue: +(p.totalSV / p.count).toFixed(2),
      score: p.score,
      color: seriesColor(i),
    }));
}
export function buildAuthorBubbles(articles: NewsArticle[], limit = 14): DistBubble[] {
  return buildAuthors(articles)
    .slice(0, limit)
    .map((a, i) => ({
      name: a.name,
      articles: a.count,
      storyValue: +(a.totalSV / a.count).toFixed(2),
      score: a.score,
      color: seriesColor(i),
    }));
}

// ── Top Publishers swimlane (web parity: #db-toppub / topPubData) ──
// One lane per publisher; each article is a dot placed along the time axis.
export interface PublisherSwimlane {
  lanes: { label: string; color: string; count: number }[];
  dots: { lane: number; t: number; jitter: number; color: string }[];
  dayLabels: string[];
}
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
export function buildPublisherSwimlane(articles: NewsArticle[], limit = 10): PublisherSwimlane {
  const byCount = [...buildPublishers(articles)].sort((a, b) => b.count - a.count).slice(0, limit);
  const laneIndex = new Map(byCount.map((p, i) => [p.name, i]));
  const lanes = byCount.map((p, i) => ({ label: p.name, color: seriesColor(i), count: p.count }));

  const times = articles.map((a) => parseDate(a.date)).filter((t) => t > 0);
  const max = times.length ? Math.max(...times) : 1;
  const rawMin = times.length ? Math.min(...times) : 0;
  const min = Math.max(rawMin, max - 56 * DAY); // cap the window at ~8 weeks
  const span = Math.max(1, max - min);

  const dots = articles
    .filter((a) => laneIndex.has(a.outlet) && parseDate(a.date) > 0)
    .map((a, i) => {
      const lane = laneIndex.get(a.outlet) ?? 0;
      const h = hashId(a.id + i);
      return {
        lane,
        t: Math.max(0, Math.min(1, (parseDate(a.date) - min) / span)),
        jitter: (h % 13) - 6,
        color: seriesColor(lane),
      };
    });

  const dayLabels: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(min + (span * i) / 4);
    dayLabels.push(`${MONTHS[d.getMonth()]} ${d.getDate()}`);
  }
  return { lanes, dots, dayLabels };
}

// ── Entities treemap (top N by frequency → % share) ──
export function buildEntitiesMap(articles: NewsArticle[], topN = 7): EntityTile[] {
  const counts = new Map<string, number>();
  articles.forEach((a) => a.entities.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
  return sorted.map(([name, c], i) => ({ name, value: (c / total) * 100, color: seriesColor(i) }));
}

// ── Compare Categories/Buckets (web parity: openCompareModal / doCompare) ──
// All selectable top-level categories, and a per-category summary comparing the
// coverage each pulls — the data behind the mobile Compare sheet.
export const COMPARE_CATEGORIES: string[] = CATEGORY_TAXONOMY.map((c) => c.name);

export interface CategoryCompare {
  category: string;
  color: string;
  articles: number;
  ave: number;
  avgSV: number;
  sentiment: { positive: number; neutral: number; negative: number };
  topPublisher: string | null;
  topEntity: string | null;
}

export function articlesForCategory(allArticles: NewsArticle[], category: string): NewsArticle[] {
  const buckets = new Set(bucketsForCategory(category));
  return allArticles.filter((a) => a.entities.some((e) => buckets.has(e)));
}

export function buildCategoryComparison(allArticles: NewsArticle[], categories: string[]): CategoryCompare[] {
  return categories.map((category, i) => {
    const items = articlesForCategory(allArticles, category);
    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    items.forEach((a) => (sentiment[a.sentiment] += 1));
    const topPub = countBy(items, (a) => a.outlet)[0];
    const buckets = new Set(bucketsForCategory(category));
    const entCounts = new Map<string, number>();
    // Top entity, excluding the bucket names themselves so it surfaces a real org/person.
    items.forEach((a) => a.entities.forEach((e) => { if (!buckets.has(e)) entCounts.set(e, (entCounts.get(e) ?? 0) + 1); }));
    const topEnt = [...entCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      category,
      color: seriesColor(i),
      articles: items.length,
      ave: items.reduce((s, a) => s + a.ave, 0),
      avgSV: items.length ? +(items.reduce((s, a) => s + a.storyValue, 0) / items.length).toFixed(2) : 0,
      sentiment,
      topPublisher: topPub ? topPub[0] : null,
      topEntity: topEnt ? topEnt[0] : null,
    };
  });
}
