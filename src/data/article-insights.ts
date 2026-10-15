// MediaWatch dashboard Insights — the article analogue of components/dashboard/
// insights.ts. Produces the SAME InsightReport shape the InsightsSheet renders,
// but every number is computed from newsArticles so each panel agrees with the
// chart it sits behind. Drill-through predicates are SocialMention-typed in the
// shared InsightDrill, so the article rows omit `drill` (they render as
// non-tappable rank rows) — the panels still surface the full narrative, stats,
// trends and rankings.
import type { InsightReport, InsightSection } from '@/components/dashboard/insights';
import type { TimelinePoint } from '@/components/dashboard/charts';
import type { ShareSegment } from '@/components/dashboard/bars';
import type { DistBubble, PublisherSwimlane, TonalityWeek } from '@/data/article-dashboard-metrics';
import type { EntityTile } from '@/components/dashboard/treemap';

const pctOf = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 100) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;

export type ArticleInsightKind =
  | 'timeline'
  | 'exposure'
  | 'emphasis'
  | 'tonality'
  | 'frequency'
  | 'pubscore'
  | 'author'
  | 'toppub'
  | 'entities';

const noData = (title: string, sub: string): InsightReport => ({
  title,
  sub,
  narrative: 'No data for this view under the current filters — adjust the filters to see insights.',
  stats: [],
  sections: [],
  footer: '',
});

// ── Timeline ──
function timelineInsight(all: TimelinePoint[], range: number): InsightReport {
  const data = all.slice(-range);
  const n = data.length;
  if (!n) return noData('Timeline', 'Timeline');
  const results = data.map((d) => d.results);
  const total = results.reduce((s, x) => s + x, 0);
  const avg = Math.round(total / Math.max(1, n));
  let peak = data[0];
  let trough = data[0];
  for (const d of data) {
    if (d.results > peak.results) peak = d;
    if (d.results < trough.results) trough = d;
  }
  const first = data[0];
  const last = data[n - 1];
  const trendPct = first.results ? Math.round(((last.results - first.results) / first.results) * 100) : 0;
  const h = Math.max(1, Math.floor(n / 3));
  const lastAvg = Math.round(mean(results.slice(-h)));
  const prevAvg = Math.round(mean(results.slice(-2 * h, -h))) || lastAvg;
  const topDays = [...data].sort((a, b) => b.results - a.results).slice(0, 3);
  const topMax = topDays[0]?.results ?? 0;

  return {
    title: 'Timeline',
    sub: `Timeline · last ${range} days`,
    narrative: `Coverage ${trendPct >= 0 ? 'climbed' : 'eased'} over the last ${range} days, peaking on **${peak.date}** with **${peak.results}** results. The quietest day was **${trough.date}** (${trough.results}).`,
    stats: [
      { label: 'Total results', value: String(total), sub: `across ${n} days` },
      { label: 'Peak day', value: String(peak.results), sub: peak.date },
      { label: 'Daily average', value: String(avg), sub: 'results / day' },
      { label: 'Trend', value: `${signed(trendPct)}%`, sub: 'first → last day', tone: trendPct >= 0 ? 'up' : 'down' },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'trending-up',
        title: 'Key trends',
        icons: [trendPct >= 0 ? 'trending-up' : 'trending-down', 'pulse', 'stats-chart'],
        items: [
          `Overall **${signed(trendPct)}%** from ${first.date} (${first.results}) to ${last.date} (${last.results}).`,
          `Momentum is **${lastAvg >= prevAvg ? 'building' : 'cooling'}** — recent days average **${lastAvg}** vs ${prevAvg} earlier.`,
          `Daily volume ranges **${trough.results}–${peak.results}** results.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Top days by volume',
        rows: topDays.map((d) => ({ name: d.date, value: String(d.results), pct: pctOf(d.results, topMax) })),
      },
    ],
    footer: 'AI-generated summary derived from the current media filter and date range.',
  };
}

// ── Share-of-segments (Media Exposure / Topic Emphasis) ──
function shareInsight(title: string, sub: string, segs: ShareSegment[], noun: string): InsightReport {
  if (!segs.length) return noData(title, sub);
  const total = segs.reduce((s, e) => s + e.value, 0) || 1;
  const rows = segs
    .map((e) => ({ label: e.label, color: e.color, count: e.value, pct: (e.value / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const top = rows[0];
  const last = rows[rows.length - 1];
  const second = rows[1];
  const mult = second && second.pct ? top.pct / second.pct : 0;
  const max = top.pct;

  return {
    title,
    sub,
    narrative: `**${top.label}** leads ${noun} at **${top.pct.toFixed(1)}%** (${top.count})${
      mult >= 1.5 && second ? `, over **${mult.toFixed(1)}×** the next (${second.label}, ${second.pct.toFixed(1)}%)` : ''
    }.`,
    stats: [
      { label: 'Leader', value: `${top.pct.toFixed(1)}%`, sub: top.label },
      { label: 'Segments', value: String(rows.length), sub: 'with coverage' },
      { label: 'Smallest', value: `${last.pct.toFixed(1)}%`, sub: last.label },
      { label: 'Total', value: String(total), sub: noun },
    ],
    sections: [
      {
        kind: 'rank',
        icon: 'stats-chart',
        title: 'Share',
        rows: rows.map((r) => ({ name: r.label, value: `${r.pct.toFixed(1)}%`, pct: pctOf(r.pct, max), color: r.color })),
      },
    ],
    footer: `AI-generated summary of ${noun} share.`,
  };
}

// ── Tonality ──
function tonalityInsight(donut: { label: string; value: number; color: string }[], weeks: TonalityWeek[]): InsightReport {
  const tot = donut.reduce((s, d) => s + d.value, 0) || 1;
  const dom = [...donut].sort((a, b) => b.value - a.value)[0];
  const pos = donut[0]?.value ?? 0;
  const neg = donut[2]?.value ?? 0;
  const net = Math.round(((pos - neg) / tot) * 100);
  const max = dom?.value ?? 0;

  const sections: InsightSection[] = [
    {
      kind: 'rank',
      icon: 'stats-chart',
      title: 'Sentiment split',
      rows: donut.map((d) => ({ name: d.label, value: String(d.value), pct: pctOf(d.value, max), color: d.color })),
    },
  ];
  if (weeks.length) {
    const byPos = [...weeks].sort((a, b) => b.segments[0].value - a.segments[0].value);
    const peak = byPos[0];
    const peakMax = peak.segments[0].value || 1;
    sections.push({
      kind: 'rank',
      icon: 'trophy',
      title: 'Top days by positive volume',
      barColor: '#16a34a',
      rows: byPos.slice(0, 4).map((d) => ({ name: d.label, value: String(d.segments[0].value), pct: pctOf(d.segments[0].value, peakMax) })),
    });
  }

  return {
    title: 'Tonality',
    sub: 'Sentiment breakdown',
    narrative: `Sentiment skews **${dom.label.toLowerCase()}** — **${pos}** of ${tot} articles (**${((pos / tot) * 100).toFixed(0)}%**) are positive vs ${neg} negative, a net **${signed(net)}%**.`,
    stats: [
      { label: 'Total articles', value: String(tot), sub: 'in range' },
      { label: 'Dominant', value: dom.label, sub: `${((dom.value / tot) * 100).toFixed(0)}%` },
      { label: 'Net sentiment', value: `${signed(net)}%`, sub: `${pos} pos · ${neg} neg`, tone: net >= 0 ? 'up' : 'down' },
      { label: 'Positive', value: String(pos), sub: 'articles' },
    ],
    sections,
    footer: 'AI-generated summary derived from the sentiment distribution and daily tonality.',
  };
}

// ── Frequency (Story Value histogram) ──
function frequencyInsight(freq: { label: string; value: number }[]): InsightReport {
  const entries = freq.map((b, i) => [i, b.value] as [number, number]).filter(([, c]) => c > 0);
  if (!entries.length) return noData('Frequency', 'Story-value distribution');
  const tot = entries.reduce((s, [, c]) => s + c, 0) || 1;
  const m = entries.reduce((s, [v, c]) => s + v * c, 0) / tot;
  const byCount = [...entries].sort((a, b) => b[1] - a[1]);
  const vals = entries.map(([v]) => v);
  const loB = Math.min(...vals);
  const hiB = Math.max(...vals);
  const maxC = byCount[0]?.[1] ?? 0;

  return {
    title: 'Frequency',
    sub: 'Story-value distribution',
    narrative: `${tot} articles span story values **${loB}–${hiB}** with a weighted mean of **${m.toFixed(2)}**. Most common is SV **${byCount[0]?.[0]}** (${byCount[0]?.[1]} articles).`,
    stats: [
      { label: 'Total articles', value: String(tot), sub: 'in distribution' },
      { label: 'Most common', value: `SV ${byCount[0]?.[0] ?? 0}`, sub: `${byCount[0]?.[1] ?? 0} articles` },
      { label: 'Mean story value', value: m.toFixed(2), sub: 'weighted' },
      { label: 'Spread', value: `SV ${loB}–${hiB}`, sub: `${entries.length} buckets` },
    ],
    sections: [
      {
        kind: 'rank',
        icon: 'stats-chart',
        title: 'Story-value buckets',
        barColor: '#b9a4f7',
        rows: entries.map(([v, c]) => ({ name: `Story value ${v}`, value: String(c), pct: pctOf(c, maxC) })),
      },
    ],
    footer: 'AI-generated summary derived from the story-value histogram.',
  };
}

// ── Publisher / Author distributions (bubble data) ──
function bubbleInsight(title: string, sub: string, dist: DistBubble[], noun: string): InsightReport {
  if (!dist.length) return noData(title, sub);
  const byCount = [...dist].sort((a, b) => b.articles - a.articles);
  const bySv = [...dist].sort((a, b) => b.storyValue - a.storyValue);
  const prolific = byCount[0];
  const topSv = bySv[0];
  const totalArticles = dist.reduce((s, d) => s + d.articles, 0);
  const max = prolific.articles;

  return {
    title,
    sub,
    narrative: `**${prolific.name}** publishes the most (**${prolific.articles}** articles), while **${topSv.name}** carries the highest average story value (**${topSv.storyValue.toFixed(2)}**).`,
    stats: [
      { label: noun, value: String(dist.length), sub: 'tracked' },
      { label: 'Most articles', value: String(prolific.articles), sub: prolific.name },
      { label: 'Top story value', value: topSv.storyValue.toFixed(2), sub: topSv.name },
      { label: 'Total articles', value: String(totalArticles), sub: 'in range' },
    ],
    sections: [
      {
        kind: 'rank',
        icon: 'trophy',
        title: `${noun} by article count`,
        rows: byCount.slice(0, 6).map((d) => ({ name: d.name, value: String(d.articles), pct: pctOf(d.articles, max), color: d.color })),
      },
    ],
    footer: `AI-generated summary derived from ${noun.toLowerCase()} article counts and story values.`,
  };
}

// ── Top Publishers (swimlane) ──
function topPubInsight(swim: PublisherSwimlane): InsightReport {
  if (!swim.lanes.length) return noData('Top Publishers', '0 publishers');
  const lanes = swim.lanes;
  const total = lanes.reduce((s, l) => s + l.count, 0) || 1;
  const top = lanes[0];
  const second = lanes[1];
  const topPct = Math.round((top.count / total) * 100);
  const mult = second && second.count ? (top.count / second.count).toFixed(1) : null;

  return {
    title: 'Top Publishers',
    sub: `${lanes.length} publishers`,
    narrative: `**${top.label}** leads with **${top.count}** articles (**${topPct}%**)${mult && second ? ` — about **${mult}×** the next (${second.label})` : ''}.`,
    stats: [
      { label: 'Publishers', value: String(lanes.length), sub: 'in range' },
      { label: 'Top publisher', value: top.label, sub: `${topPct}% share` },
      { label: 'Total articles', value: String(total), sub: 'across publishers' },
      { label: 'Runner-up', value: second ? second.label : '—', sub: second ? `${second.count} articles` : '' },
    ],
    sections: [
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Publishers by article count',
        rows: lanes.map((l) => ({ name: l.label, value: String(l.count), pct: pctOf(l.count, top.count), color: l.color })),
      },
    ],
    footer: 'AI-generated summary derived from per-publisher article counts.',
  };
}

// ── Entities ──
function entitiesInsight(entities: EntityTile[]): InsightReport {
  if (!entities.length) return noData('Entities', '0 entities');
  const sorted = [...entities].sort((a, b) => b.value - a.value);
  const dom = sorted[0];
  const second = sorted[1];
  const n = sorted.length;
  const top3 = sorted.slice(0, 3).reduce((s, e) => s + e.value, 0);
  const max = dom.value;

  return {
    title: 'Entities',
    sub: `${n} entities`,
    narrative: `Coverage centers on **${dom.name}** at **${dom.value.toFixed(1)}%**${second ? `, ahead of ${second.name} (${second.value.toFixed(1)}%)` : ''}. The top 3 entities make up **${top3.toFixed(0)}%** of mentions.`,
    stats: [
      { label: 'Entities', value: String(n), sub: 'detected' },
      { label: 'Dominant', value: dom.name, sub: `${dom.value.toFixed(1)}%` },
      { label: 'Top-3 share', value: `${top3.toFixed(0)}%`, sub: 'combined' },
      { label: 'Runner-up', value: second ? second.name : '—', sub: second ? `${second.value.toFixed(1)}%` : '' },
    ],
    sections: [
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Entity breakdown',
        rows: sorted.map((e) => ({ name: e.name, value: `${e.value.toFixed(1)}%`, pct: pctOf(e.value, max), color: e.color })),
      },
    ],
    footer: 'AI-generated summary derived from the entity-share distribution.',
  };
}

export interface ArticleInsightInputs {
  timeline: TimelinePoint[];
  range: number;
  exposure: ShareSegment[];
  emphasis: ShareSegment[];
  donut: { label: string; value: number; color: string }[];
  tonalityWeeks: TonalityWeek[];
  histogram: { label: string; value: number }[];
  pubBubbles: DistBubble[];
  authorBubbles: DistBubble[];
  pubSwimlane: PublisherSwimlane;
  entities: EntityTile[];
}

export function buildArticleInsightReport(kind: ArticleInsightKind, d: ArticleInsightInputs): InsightReport {
  switch (kind) {
    case 'timeline':
      return timelineInsight(d.timeline, d.range);
    case 'exposure':
      return shareInsight('Media Exposure', 'Media Exposure · article share', d.exposure, 'articles');
    case 'emphasis':
      return shareInsight('Topic Emphasis', 'Topic Emphasis · Main vs Mention', d.emphasis, 'articles');
    case 'tonality':
      return tonalityInsight(d.donut, d.tonalityWeeks);
    case 'frequency':
      return frequencyInsight(d.histogram);
    case 'pubscore':
      return bubbleInsight('Publisher Score Distribution', 'Publishers · article count × story value', d.pubBubbles, 'Publishers');
    case 'author':
      return bubbleInsight('Author Story Value Distribution', 'Authors · article count × story value', d.authorBubbles, 'Authors');
    case 'toppub':
      return topPubInsight(d.pubSwimlane);
    case 'entities':
      return entitiesInsight(d.entities);
  }
}
