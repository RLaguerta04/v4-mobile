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
import type { MediaChannel, NewsArticle } from '@/data/mediawatch-types';
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

  push({ key: 'total', label: 'Total Results', value: String(articles.length), isNumber: true });

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

// ── Entities treemap (top N by frequency → % share) ──
export function buildEntitiesMap(articles: NewsArticle[], topN = 7): EntityTile[] {
  const counts = new Map<string, number>();
  articles.forEach((a) => a.entities.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
  return sorted.map(([name, c], i) => ({ name, value: (c / total) * 100, color: seriesColor(i) }));
}
