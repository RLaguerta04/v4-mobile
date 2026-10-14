// Dashboard Insights — the AI-style narrative panels behind each chart's
// "Insights" button. Ports the web client's insight logic 1:1 by formula,
// wording, stat tiles and sections (app.js tiAnalysis/expAnalysis/SRC.*; see
// docs/dashboard-spec.md), but computes every number from THIS app's own
// derived dashboard data so each panel agrees with the chart above it. Pure
// functions → an InsightReport the InsightsSheet renders.
//
// Two reference sources have no mobile analogue and are adapted (noted inline):
//  • Timeline "Top sources" — the web tallies news outlets; SocialMention has
//    no outlet field, so we tally the in-range post handles instead.
//  • Entities — the web keys off entity TYPES (ORG/PERSON/GPE/NORP); our
//    entities are flat names, so we surface dominance/concentration/breakdown.
import {
  DashboardData,
  EntityTileData,
  InfluencerPoint,
  MediaSourcePoint,
  PlatformShare,
  storyValue,
  SwimlaneData,
  TimelinePoint,
  TonalityDay,
  TonalitySlice,
} from '@/data/dashboard-metrics';
import { SocialMention } from '@/data/types';

export type InsightKind =
  | 'timeline'
  | 'exposure'
  | 'tonality'
  | 'frequency'
  | 'entities'
  | 'topmedia'
  | 'influencer'
  | 'mediasource';

// A subset of Ionicons names used across the panels.
export type InsightIcon =
  | 'trending-up'
  | 'trending-down'
  | 'flash'
  | 'trophy'
  | 'newspaper'
  | 'bulb'
  | 'stats-chart'
  | 'people'
  | 'pulse';

// A tap-through from a row/callout to the posts behind it (mirrors the web's
// "click any bar for that day's/channel's posts"). The predicate runs against
// the screen's already-filtered mentions.
export interface InsightDrill {
  title: string;
  match: (m: SocialMention) => boolean;
}

export interface InsightStat {
  label: string;
  value: string;
  sub: string;
  tone?: 'up' | 'down';
}

export interface InsightRankRow {
  name: string;
  value: string;
  pct: number; // 0–100 bar fill
  color?: string;
  drill?: InsightDrill;
}

export interface InsightCallout {
  icon: InsightIcon;
  tone: 'up' | 'down' | 'neutral';
  label: string;
  sub: string;
  value: string;
  drill?: InsightDrill;
}

export type InsightSection =
  // `icons`, if present, is aligned by index with `items` — a muted per-row
  // glyph (the web's .ti-insight icons); rows without one fall back to `icon`.
  | { kind: 'insights'; icon: InsightIcon; title: string; items: string[]; icons?: InsightIcon[] }
  | { kind: 'callouts'; icon: InsightIcon; title: string; callouts: InsightCallout[] }
  | { kind: 'rank'; icon: InsightIcon; title: string; rows: InsightRankRow[]; barColor?: string };

export interface InsightReport {
  title: string; // detail title (breadcrumb)
  sub: string; // header subtitle
  narrative: string; // AI prose, **bold** markers
  stats: InsightStat[];
  sections: InsightSection[];
  footer: string;
}

// ── small helpers ──
// Fallback when an aggressive filter leaves a chart with no data to analyse.
const noData = (title: string, sub: string): InsightReport => ({
  title,
  sub,
  narrative: 'No data for this view under the current filters — adjust the filters to see insights.',
  stats: [],
  sections: [],
  footer: '',
});
const pctOf = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 100) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
const shortDate = (s: string) => s.split(',')[0]; // "Jul 20, 2026" → "Jul 20"

function topHandles(ms: SocialMention[], n: number): { handle: string; count: number }[] {
  const map = new Map<string, number>();
  ms.forEach((m) => map.set(m.handle, (map.get(m.handle) ?? 0) + 1));
  return [...map.entries()]
    .map(([handle, count]) => ({ handle, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

// ════════════════════════════ 1. Timeline ════════════════════════════
const TL_RANGE_LABEL: Record<number, string> = {
  3: 'last 3 days',
  7: 'last 7 days',
  15: 'last 15 days',
  30: 'last 30 days',
};

function timelineInsight(all: TimelinePoint[], range: number, filtered: SocialMention[]): InsightReport {
  const data = all.slice(-range);
  const n = data.length;
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

  // biggest day-over-day rise / fall
  let spike: { day: TimelinePoint; delta: number } | null = null;
  let drop: { day: TimelinePoint; delta: number } | null = null;
  for (let i = 1; i < n; i++) {
    const delta = results[i] - results[i - 1];
    if (!spike || delta > spike.delta) spike = { day: data[i], delta };
    if (!drop || delta < drop.delta) drop = { day: data[i], delta };
  }

  const h = Math.max(1, Math.floor(n / 3));
  const lastAvg = Math.round(mean(results.slice(-h)));
  const prevAvg = Math.round(mean(results.slice(-2 * h, -h))) || lastAvg;
  const momUp = lastAvg >= prevAvg;

  const topDays = [...data].sort((a, b) => b.results - a.results).slice(0, 3);
  const topMax = topDays[0]?.results ?? 0;

  // Top sources — adapted: tally handles of posts falling inside this range.
  const dayKeys = new Set(data.map((d) => d.fullDate));
  const inRange = filtered.filter((m) => dayKeys.has(m.date));
  const srcRows = topHandles(inRange, 4);
  const srcMax = srcRows[0]?.count ?? 0;

  const dayDrill = (d: TimelinePoint): InsightDrill => ({
    title: d.fullDate,
    match: (m) => m.date === d.fullDate,
  });

  const sections: InsightSection[] = [
    {
      kind: 'insights',
      icon: 'trending-up',
      title: 'Key trends',
      icons: [trendPct >= 0 ? 'trending-up' : 'trending-down', 'pulse', 'stats-chart'],
      items: [
        `Overall **${signed(trendPct)}%** from ${first.date} (${first.results}) to ${last.date} (${last.results}).`,
        `Momentum is **${momUp ? 'building' : 'cooling'}** — recent days average **${lastAvg}** vs ${prevAvg} earlier.`,
        `Daily volume ranges **${trough.results}–${peak.results}** results.`,
      ],
    },
  ];

  if (spike && drop && n >= 2) {
    sections.push({
      kind: 'callouts',
      icon: 'flash',
      title: 'Notable spikes & drops',
      callouts: [
        {
          icon: 'trending-up',
          tone: 'up',
          label: `Spike on ${spike.day.date}`,
          sub: 'Biggest day-over-day rise',
          value: signed(spike.delta),
          drill: dayDrill(spike.day),
        },
        {
          icon: 'trending-down',
          tone: 'down',
          label: `Drop on ${drop.day.date}`,
          sub: 'Largest single-day fall',
          value: String(drop.delta),
          drill: dayDrill(drop.day),
        },
      ],
    });
  }

  sections.push({
    kind: 'rank',
    icon: 'trophy',
    title: 'Top days by volume',
    rows: topDays.map((d) => ({
      name: d.fullDate,
      value: String(d.results),
      pct: pctOf(d.results, topMax),
      drill: dayDrill(d),
    })),
  });

  if (srcRows.length) {
    sections.push({
      kind: 'rank',
      icon: 'newspaper',
      title: 'Top sources',
      barColor: '#7c3aed',
      rows: srcRows.map((s) => ({
        name: s.handle,
        value: String(s.count),
        pct: pctOf(s.count, srcMax),
        drill: { title: s.handle, match: (m) => m.handle === s.handle },
      })),
    });
  }

  const rangeLabel = TL_RANGE_LABEL[range] ?? `last ${range} days`;
  return {
    title: 'Timeline',
    sub: `Timeline · ${rangeLabel}`,
    narrative: `Coverage ${trendPct >= 0 ? 'climbed' : 'eased'} over the ${rangeLabel}, peaking on **${peak.date}** with **${peak.results}** results. The quietest day was **${trough.date}** (${trough.results}).`,
    stats: [
      { label: 'Total results', value: String(total), sub: `across ${n} days` },
      { label: 'Peak day', value: String(peak.results), sub: peak.date },
      { label: 'Daily average', value: String(avg), sub: 'results / day' },
      { label: 'Trend', value: `${signed(trendPct)}%`, sub: 'first → last day', tone: trendPct >= 0 ? 'up' : 'down' },
    ],
    sections,
    footer: "AI-generated summary derived from the current filter and date range. Tap any row for that day's posts.",
  };
}

// ════════════════════════════ 2. Platform Exposure ════════════════════════════
function exposureInsight(exposure: PlatformShare[]): InsightReport {
  if (!exposure.length) return noData('Platform Exposure', 'Platform Exposure · post share');
  const total = exposure.reduce((s, e) => s + e.count, 0) || 1;
  const rows = exposure
    .map((e) => ({ label: e.label, color: e.color, platform: e.platform, count: e.count, pct: (e.count / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const top = rows[0];
  const second = rows[1];
  const last = rows[rows.length - 1];
  const top3 = +rows.slice(0, 3).reduce((s, r) => s + r.pct, 0).toFixed(2);
  const tail = +rows.slice(3).reduce((s, r) => s + r.pct, 0).toFixed(2);
  const active = rows.filter((r) => r.pct > 0).length;
  const mult = second && second.pct ? top.pct / second.pct : 0;
  const max = top.pct;

  return {
    title: 'Platform Exposure',
    sub: 'Platform Exposure · post share',
    narrative: `**${top.label}** dominates exposure at **${top.pct.toFixed(2)}%** (${top.count} posts)${
      mult >= 1.5 ? `, over **${mult.toFixed(1)}×** the next channel (${second.label}, ${second.pct.toFixed(2)}%)` : ''
    }. The top 3 channels carry **${top3}%** of all coverage.`,
    stats: [
      { label: 'Top channel', value: `${top.pct.toFixed(2)}%`, sub: top.label },
      { label: 'Top-3 concentration', value: `${top3}%`, sub: 'of all coverage' },
      { label: 'Active channels', value: String(active), sub: 'with coverage' },
      { label: 'Long tail', value: `${tail}%`, sub: `bottom ${Math.max(0, rows.length - 3)} channels` },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'bulb',
        title: 'Key insights',
        items: [
          `**${top.label}** leads with **${top.pct.toFixed(2)}%** (${top.count} posts)${
            mult >= 1.5 ? ` — ${mult.toFixed(1)}× the next channel` : ''
          }.`,
          `Coverage is **${top3 >= 70 ? 'highly concentrated' : 'fairly spread'}** — the top 3 channels hold **${top3}%**.`,
          `Smallest channel is **${last.label}** at just **${last.pct.toFixed(2)}%**.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'stats-chart',
        title: 'Channel share',
        rows: rows.map((r) => ({
          name: r.label,
          value: `${r.pct.toFixed(2)}%`,
          pct: pctOf(r.pct, max),
          color: r.color,
          drill: { title: r.label, match: (m) => m.platform === r.platform },
        })),
      },
    ],
    footer: "AI-generated summary of channel share. Tap any row for that channel's posts.",
  };
}

// ════════════════════════════ 3. Tonality ════════════════════════════
function tonalityInsight(donut: TonalitySlice[], timeline: TonalityDay[]): InsightReport {
  const val = (s: string) => donut.find((d) => d.sentiment === s)?.value ?? 0;
  const pos = val('positive');
  const neu = val('neutral');
  const neg = val('negative');
  const tot = pos + neu + neg || 1;
  const dom = [...donut].sort((a, b) => b.value - a.value)[0];
  const net = Math.round(((pos - neg) / tot) * 100);
  const posPct = (pos / tot) * 100;
  const negPct = (neg / tot) * 100;
  const ratio = neg ? (pos / neg).toFixed(1) : String(pos);

  const byPos = [...timeline].sort((a, b) => b.positive - a.positive);
  const peak = byPos[0];
  const negDay = timeline.filter((d) => d.negative > 0).sort((a, b) => b.negative - a.negative)[0];
  const firstD = timeline[0];
  const lastD = timeline[timeline.length - 1];
  const improving = lastD && firstD ? lastD.positive - lastD.negative >= firstD.positive - firstD.negative : true;
  const netNegDays = timeline.filter((d) => d.negative >= d.positive && d.negative > 0).length;
  const peakMax = peak?.positive ?? 0;

  const items = [
    `Positive leads at **${posPct.toFixed(0)}%** — about **${ratio}×** the negative share (${negPct.toFixed(0)}%).`,
  ];
  if (peak && firstD && lastD) {
    items.push(
      `Tone is **${improving ? 'improving' : 'softening'}** — ${lastD.label} ran ${lastD.positive}:${lastD.negative} pos:neg vs ${firstD.positive}:${firstD.negative} early on.`,
    );
  }
  items.push(
    `${netNegDays === 0 ? 'No day was net-negative' : `${netNegDays} day(s) ran net-negative`} across the range — narrative risk is ${netNegDays === 0 ? 'low' : 'worth watching'}.`,
  );

  const sections: InsightSection[] = [{ kind: 'insights', icon: 'trending-up', title: 'Key trends', items }];

  if (peak) {
    const callouts: InsightCallout[] = [
      {
        icon: 'trending-up',
        tone: 'up',
        label: `Most positive · ${peak.label}`,
        sub: 'Highest positive volume',
        value: `+${peak.positive}`,
      },
    ];
    if (negDay) {
      callouts.push({
        icon: 'trending-down',
        tone: 'down',
        label: `Negative driver · ${negDay.label}`,
        sub: 'Most negative mentions',
        value: `−${negDay.negative}`,
      });
    }
    sections.push({ kind: 'callouts', icon: 'flash', title: 'Notable days', callouts });
    sections.push({
      kind: 'rank',
      icon: 'trophy',
      title: 'Top days by positive volume',
      barColor: '#16a34a',
      rows: byPos.slice(0, 4).map((d) => ({
        name: d.label,
        value: String(d.positive),
        pct: pctOf(d.positive, peakMax),
      })),
    });
    const takeaways = [`Amplify the **${peak.label}** positive coverage through owned channels while momentum holds.`];
    if (negDay) {
      takeaways.push(`Investigate the **${negDay.label}** negative driver before it shapes the wider narrative.`);
    }
    sections.push({ kind: 'insights', icon: 'bulb', title: 'Takeaways', items: takeaways });
  }

  return {
    title: 'Tonality',
    sub: 'Sentiment breakdown',
    narrative: `Sentiment skews **${dom.label.toLowerCase()}** — **${pos}** of ${tot} mentions (**${posPct.toFixed(0)}%**) are positive vs ${neg} negative, a net **${signed(net)}%**.${
      peak ? ` Tone ${improving ? 'improved' : 'softened'} over the range, peaking on **${peak.label}**.` : ''
    }`,
    stats: [
      { label: 'Total mentions', value: String(tot), sub: 'in range' },
      { label: 'Dominant', value: dom.label, sub: `${posPct.toFixed(0)}% of mentions` },
      { label: 'Net sentiment', value: `${signed(net)}%`, sub: `${pos} pos · ${neg} neg`, tone: net >= 0 ? 'up' : 'down' },
      { label: 'Peak positive', value: String(peak?.positive ?? 0), sub: peak?.label ?? '—' },
    ],
    sections,
    footer: 'AI-generated summary derived from the sentiment distribution and daily tonality.',
  };
}

// ════════════════════════════ 4. Frequency ════════════════════════════
function frequencyInsight(freq: { label: string; value: number }[]): InsightReport {
  const entries = freq
    .map((b, i) => [i, b.value] as [number, number])
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[0] - b[0]);
  if (!entries.length) return noData('Frequency', 'Story-value distribution');
  const tot = entries.reduce((s, [, c]) => s + c, 0) || 1;
  const m = entries.reduce((s, [v, c]) => s + v * c, 0) / tot;
  const byCount = [...entries].sort((a, b) => b[1] - a[1]);
  const vals = entries.map(([v]) => v);
  const loB = vals.length ? Math.min(...vals) : 0;
  const hiB = vals.length ? Math.max(...vals) : 0;
  const present = new Set(vals);
  const midEmpty: number[] = [];
  for (let v = loB + 1; v < hiB; v++) if (!present.has(v)) midEmpty.push(v);
  const bimodal = byCount.length >= 2 && Math.abs(byCount[0][0] - byCount[1][0]) >= 3;
  const maxC = byCount[0]?.[1] ?? 0;
  const lo = entries.filter(([v]) => v <= 1).reduce((s, [, c]) => s + c, 0);
  const hi = entries.filter(([v]) => v >= 4).reduce((s, [, c]) => s + c, 0);

  return {
    title: 'Frequency',
    sub: 'Story-value distribution',
    narrative: `${tot} posts span story values **${loB}–${hiB}**, ${bimodal ? 'clustering at **both ends**' : 'concentrated'} with a weighted mean of **${m.toFixed(2)}**. ${lo} low-value (≤1) vs ${hi} high-value (≥4) posts.`,
    stats: [
      { label: 'Total Posts', value: String(tot), sub: 'in distribution' },
      { label: 'Most common', value: `SV ${byCount[0]?.[0] ?? 0}`, sub: `${byCount[0]?.[1] ?? 0} posts` },
      { label: 'Mean story value', value: m.toFixed(2), sub: 'weighted' },
      { label: 'Spread', value: `SV ${loB}–${hiB}`, sub: `${entries.length} active buckets` },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'trending-up',
        title: 'Key trends',
        items: [
          `Distribution is **${bimodal ? 'bimodal' : 'concentrated'}** — peaks at SV ${byCount[0]?.[0] ?? 0} (${byCount[0]?.[1] ?? 0})${byCount[1] ? ` and SV ${byCount[1][0]} (${byCount[1][1]})` : ''}.`,
          midEmpty.length
            ? `Mid-range is thin — no posts at SV ${midEmpty.join(', ')}, so little "moderate" coverage.`
            : `Coverage fills the mid-range — a steady spread across story values.`,
          `Mean SV of **${m.toFixed(2)}** ${m < 2 ? 'sits low' : 'is moderate'} — overall value is pulled up by the high-SV cluster.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'stats-chart',
        title: 'Story-value buckets',
        barColor: '#b9a4f7',
        rows: entries.map(([v, c]) => ({
          name: `Story value ${v.toFixed(2)}`,
          value: String(c),
          pct: pctOf(c, maxC),
          drill: { title: `Story value ${v}`, match: (mm) => Math.floor(storyValue(mm)) === v },
        })),
      },
      {
        kind: 'insights',
        icon: 'bulb',
        title: 'Takeaways',
        items: [
          `Dig into the **SV ${hiB}** cluster — the high-value stories driving the most reach.`,
          `The split suggests two content types; segment reporting to track low- vs high-value output separately.`,
        ],
      },
    ],
    footer: 'AI-generated summary derived from the story-value histogram.',
  };
}

// ════════════════════════════ 5. Entities (adapted) ════════════════════════════
function entitiesInsight(entities: EntityTileData[]): InsightReport {
  if (!entities.length) return noData('Entities', '0 entities');
  const sorted = [...entities].sort((a, b) => b.value - a.value);
  const dom = sorted[0];
  const second = sorted[1];
  const third = sorted[2];
  const last = sorted[sorted.length - 1];
  const n = sorted.length;
  const top3 = sorted.slice(0, 3).reduce((s, e) => s + e.value, 0);
  const tail = sorted.slice(3).reduce((s, e) => s + e.value, 0);
  const max = dom?.value ?? 0;

  return {
    title: 'Entities',
    sub: `${n} entities`,
    narrative: `Coverage centers on **${dom.name}** — the top entity at **${dom.value.toFixed(1)}%**${
      second ? `, ahead of ${second.name} (${second.value.toFixed(1)}%)` : ''
    }. The top 3 entities make up **${top3.toFixed(0)}%** of all mentions.`,
    stats: [
      { label: 'Entities tracked', value: String(n), sub: 'detected' },
      { label: 'Dominant', value: dom.name, sub: `${dom.value.toFixed(1)}%` },
      { label: 'Top-3 share', value: `${top3.toFixed(0)}%`, sub: 'combined' },
      { label: 'Long tail', value: `${tail.toFixed(1)}%`, sub: `bottom ${Math.max(0, n - 3)}` },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'trending-up',
        title: 'Key observations',
        items: [
          `**${dom.name}** dominates at **${dom.value.toFixed(1)}%** — the single biggest share of entity mentions.`,
          second
            ? `**${second.name}** follows at **${second.value.toFixed(1)}%**${third ? `, then ${third.name} (${third.value.toFixed(1)}%)` : ''}.`
            : `Coverage is concentrated on a single entity.`,
          `The long tail (${n > 3 ? n - 3 : 0} smaller entit${n - 3 === 1 ? 'y' : 'ies'}) accounts for just **${tail.toFixed(1)}%**.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Entity breakdown',
        rows: sorted.map((e) => ({
          name: e.name,
          value: `${e.value.toFixed(2)}%`,
          pct: pctOf(e.value, max),
          color: e.color,
          drill: { title: e.name, match: (m) => m.entities.includes(e.name) },
        })),
      },
      {
        kind: 'insights',
        icon: 'bulb',
        title: 'Takeaways',
        items: [
          `Keep monitoring **${dom.name}** closely — it leads the conversation.`,
          second ? `Watch whether **${second.name}** closes the gap with ${dom.name}.` : `Broaden tracking to surface emerging entities.`,
        ],
      },
    ],
    footer: 'AI-generated summary derived from the entity-share distribution.',
  };
}

// ════════════════════════════ 6. Top Media Sources ════════════════════════════
function topMediaInsight(swim: SwimlaneData, filtered: SocialMention[]): InsightReport {
  if (!swim.lanes.length) return noData('Top media sources', '0 platforms');
  const lanes = swim.lanes; // already sorted desc by count
  const n = lanes.length;
  const total = lanes.reduce((s, l) => s + l.count, 0) || 1;
  const top = lanes[0];
  const second = lanes[1];
  const topPct = Math.round((top.count / total) * 100);
  const top2Pct = Math.round(((top.count + (second?.count ?? 0)) / total) * 100);
  const mult = second && second.count ? (top.count / second.count).toFixed(1) : null;

  // busiest day — tally the real posts by date (swimlane dots carry no date)
  const dayMap = new Map<string, number>();
  filtered.forEach((m) => dayMap.set(shortDate(m.date), (dayMap.get(shortDate(m.date)) ?? 0) + 1));
  const busiest = [...dayMap.entries()].sort((a, b) => b[1] - a[1])[0];

  const infRows = topHandles(filtered, 4);
  const infMax = infRows[0]?.count ?? 0;

  const sections: InsightSection[] = [
    {
      kind: 'insights',
      icon: 'trending-up',
      title: 'Key trends',
      items: [
        `**${top.label}** leads with **${top.count}** posts${
          mult && second ? ` — about **${mult}×** the next platform (${second.label}, ${second.count})` : ''
        }.`,
        `Platform concentration is **${top2Pct >= 80 ? 'high' : 'moderate'}** — the top two account for ${top2Pct}% while ${n - 2 > 0 ? n - 2 : 0} other${n - 2 !== 1 ? 's' : ''} split the rest.`,
        ...(busiest ? [`Posting peaks on **${busiest[0]}** (${busiest[1]} posts) — the busiest day in the window.`] : []),
      ],
    },
    {
      kind: 'rank',
      icon: 'trophy',
      title: 'Platforms by post count',
      rows: lanes.map((l) => ({
        name: l.label,
        value: String(l.count),
        pct: pctOf(l.count, top.count),
        color: l.color,
        drill: { title: l.label, match: (m) => m.platform === l.platform },
      })),
    },
  ];

  if (infRows.length) {
    sections.push({
      kind: 'rank',
      icon: 'people',
      title: 'Top influencers by volume',
      barColor: '#7c3aed',
      rows: infRows.map((r) => ({
        name: r.handle,
        value: String(r.count),
        pct: pctOf(r.count, infMax),
        drill: { title: r.handle, match: (m) => m.handle === r.handle },
      })),
    });
  }

  sections.push({
    kind: 'insights',
    icon: 'bulb',
    title: 'Takeaways',
    items: [
      `Focus monitoring and engagement on **${top.label}** — it carries the bulk of conversation volume.`,
      `Watch the smaller platforms (${lanes.slice(-2).map((l) => l.label).join(', ')}) for emerging shifts before they scale.`,
    ],
  });

  return {
    title: 'Top media sources',
    sub: `${n} platforms`,
    narrative: `**${top.label}** dominates the platform mix — **${top.count}** of ${total} posts (**${topPct}%**). The top two platforms carry **${top2Pct}%** of all volume, so distribution is ${top2Pct >= 80 ? 'highly concentrated' : 'moderately spread'}.`,
    stats: [
      { label: 'Total posts', value: String(total), sub: `across ${n} platforms` },
      { label: 'Top platform', value: top.label, sub: `${topPct}% share` },
      { label: 'Top-2 share', value: `${top2Pct}%`, sub: `${top.label} + ${second ? second.label : '—'}` },
      { label: 'Busiest day', value: busiest ? busiest[0] : '—', sub: busiest ? `${busiest[1]} posts` : '' },
    ],
    sections,
    footer: 'AI-generated summary derived from platform post counts and posting activity.',
  };
}

// ════════════════════════════ 7. Influencer Story Value ════════════════════════════
function influencerInsight(dist: InfluencerPoint[]): InsightReport {
  const n = dist.length;
  const bySv = [...dist].sort((a, b) => b.sv - a.sv);
  const top = bySv[0];
  const prolific = [...dist].sort((a, b) => b.posts - a.posts)[0];
  const topScore = [...dist].sort((a, b) => b.score - a.score)[0];
  const totPosts = dist.reduce((s, d) => s + d.posts, 0);
  const avgSv = dist.reduce((s, d) => s + d.sv, 0) / Math.max(1, n);
  const efficient = [...dist].sort((a, b) => b.sv / b.posts - a.sv / a.posts)[0];
  const max = top?.sv ?? 0;

  return {
    title: 'Influencer story value',
    sub: `${n} influencers`,
    narrative: `**${top.name}** drives the highest story value at **${top.sv.toFixed(2)}** from just ${top.posts} post${top.posts !== 1 ? 's' : ''}. Most prolific is **${prolific.name}** (${prolific.posts} posts); influence spans **${n}** accounts.`,
    stats: [
      { label: 'Influencers', value: String(n), sub: 'tracked' },
      { label: 'Top story value', value: top.sv.toFixed(2), sub: top.name },
      { label: 'Most posts', value: String(prolific.posts), sub: prolific.name },
      { label: 'Top influencer score', value: topScore.score.toFixed(2), sub: topScore.name },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'trending-up',
        title: 'Key trends',
        items: [
          `**${top.name}**${bySv[1] ? ` and **${bySv[1].name}**` : ''} generate the most story value (${top.sv.toFixed(2)}${bySv[1] ? `, ${bySv[1].sv.toFixed(2)}` : ''}).`,
          `Most efficient is **${efficient.name}** — **${(efficient.sv / efficient.posts).toFixed(2)}** story value per post.`,
          `${totPosts} posts across ${n} influencers, averaging **${avgSv.toFixed(2)}** story value each.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Top influencers by story value',
        barColor: '#7c3aed',
        rows: bySv.slice(0, 5).map((a) => ({
          name: a.name,
          value: a.sv.toFixed(2),
          pct: pctOf(a.sv, max),
          color: a.color,
          drill: { title: a.name, match: (m) => m.handle === a.handle },
        })),
      },
      {
        kind: 'insights',
        icon: 'bulb',
        title: 'Takeaways',
        items: [
          `Prioritize **${top.name}** and **${prolific.name}** — highest value and highest volume respectively.`,
          `Track **${efficient.name}** — a high value-per-post rate signals concentrated influence worth amplifying.`,
        ],
      },
    ],
    footer: 'AI-generated summary derived from influencer post counts, story value, and influence scores.',
  };
}

// ════════════════════════════ 8. Media Source Distribution ════════════════════════════
function mediaSourceInsight(ms: MediaSourcePoint[]): InsightReport {
  if (!ms.length) return noData('Media source distribution', '0 platforms');
  const n = ms.length;
  const total = ms.reduce((s, p) => s + p.postCount, 0) || 1;
  const byPost = [...ms].sort((a, b) => b.postCount - a.postCount);
  const domV = byPost[0];
  const domVpct = Math.round((domV.postCount / total) * 100);
  const topSv = [...ms].sort((a, b) => b.storyValue - a.storyValue)[0];
  const decoupled = domV.platform !== topSv.platform;
  const avgSv = ms.reduce((s, p) => s + p.storyValue, 0) / Math.max(1, n);

  return {
    title: 'Media source distribution',
    sub: `${n} platforms`,
    narrative: `**${domV.label}** carries the most volume — **${domV.postCount}** of ${total} posts (**${domVpct}%**) — but **${topSv.label}** posts the highest story value (**${topSv.storyValue.toFixed(2)}**). Volume and value ${decoupled ? 'are **decoupled**' : 'align'}.`,
    stats: [
      { label: 'Total posts', value: String(total), sub: `across ${n} platforms` },
      { label: 'Top volume', value: domV.label, sub: `${domVpct}% of posts` },
      { label: 'Top story value', value: topSv.storyValue.toFixed(2), sub: topSv.label },
      { label: 'Avg story value', value: avgSv.toFixed(2), sub: 'per platform' },
    ],
    sections: [
      {
        kind: 'insights',
        icon: 'trending-up',
        title: 'Key trends',
        items: [
          `**${domV.label}** dominates volume at ${domVpct}% — the primary channel for reach.`,
          `Volume ${decoupled ? 'is decoupled from' : 'aligns with'} value — **${topSv.label}** (${topSv.storyValue.toFixed(2)} SV) ${decoupled ? 'punches above its post count' : 'leads on both'}.`,
          `Story value averages **${avgSv.toFixed(2)}** per platform — ${topSv.storyValue > avgSv * 1.5 ? `skewed by ${topSv.label}` : 'fairly even'}.`,
        ],
      },
      {
        kind: 'rank',
        icon: 'trophy',
        title: 'Platforms by post count',
        rows: byPost.map((p) => ({
          name: p.label,
          value: String(p.postCount),
          pct: pctOf(p.postCount, domV.postCount),
          color: p.color,
          drill: { title: p.label, match: (m) => m.platform === p.platform },
        })),
      },
      {
        kind: 'insights',
        icon: 'bulb',
        title: 'Takeaways',
        items: [
          `Use **${domV.label}** for reach and **${topSv.label}** for high-value, quotable posts.`,
          `Investigate why **${topSv.label}** over-indexes on story value despite lower volume.`,
        ],
      },
    ],
    footer: 'AI-generated summary derived from per-platform post counts and story values.',
  };
}

// ── dispatcher ──
export function buildInsightReport(
  kind: InsightKind,
  data: DashboardData,
  filtered: SocialMention[],
  range: number,
): InsightReport {
  switch (kind) {
    case 'timeline':
      return timelineInsight(data.timeline, range, filtered);
    case 'exposure':
      return exposureInsight(data.exposure);
    case 'tonality':
      return tonalityInsight(data.tonalityDonut, data.tonalityTimeline);
    case 'frequency':
      return frequencyInsight(data.frequency);
    case 'entities':
      return entitiesInsight(data.entities);
    case 'topmedia':
      return topMediaInsight(data.swimlane, filtered);
    case 'influencer':
      return influencerInsight(data.influencerDist);
    case 'mediasource':
      return mediaSourceInsight(data.mediaSource);
  }
}
