// Dashboard derivations — the single source of numbers for the Dashboard
// screen and its drill-downs. Mirrors the web dashboard's widgets (see
// docs/dashboard-spec.md) but computes every value from THIS app's own
// socialMentions + influencers (the web's figures are hardcoded telecom mock
// data). Pure functions only, so the screen can useMemo the whole bundle.
import { influencers as INFLUENCERS, socialMentions } from '@/data/sample-data';
import { InfluencerStat, Sentiment, SocialMention, SocialPlatform } from '@/data/types';
import {
  PLATFORM_CHART_COLOR,
  PLATFORM_COLOR,
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  SENTIMENT_COLOR,
  SENTIMENT_LABEL,
  seriesColor,
} from '@/components/dashboard/palette';

// ── per-chart platform palettes from the spec (§12) — intentionally NOT unified ──
export const EXP_COLOR: Record<SocialPlatform, string> = {
  facebook: '#3b7dd8',
  twitter: '#29a3f0',
  instagram: '#d6249f',
  youtube: '#ef4444',
  reddit: '#f97316',
  tiktok: '#8b5cf6',
};
export const MEDIA_SOURCE_COLOR: Record<SocialPlatform, string> = {
  facebook: '#1877f2',
  twitter: '#16a34a',
  instagram: '#1e293b',
  youtube: '#ef4444',
  reddit: '#f97316',
  tiktok: '#8b5cf6',
};
export const TMS_COLOR: Record<SocialPlatform, string> = {
  facebook: '#1877f2',
  twitter: '#f97316',
  youtube: '#ef4444',
  reddit: '#ff4500',
  instagram: '#16a34a',
  tiktok: '#8b5cf6',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Stable pseudo "vs previous period" delta. The web's deltas are static mock
// values with no real computation (spec §1), so we generate a deterministic
// one per card key — same key always yields the same %.
export function stableDelta(key: string): number {
  return (hashString(key) % 121) - 60; // -60…+60
}

// Story value proxy: the web carries a per-post story value in 0–10; we map
// the engagement score (0–100) into the same range so the frequency buckets
// (0–10) and timeline/influencer sums line up with the spec.
export function storyValue(m: SocialMention): number {
  return Math.max(0, Math.min(10, (m.engScore ?? 0) / 10));
}

export function totalEngagement(m: SocialMention): number {
  return Object.values(m.engagement as Record<string, number>).reduce((s, v) => s + (v || 0), 0);
}

function avatarInitial(name: string): string {
  return name.replace(/^[@#]/, '').replace(/^u\//, '').charAt(0).toUpperCase() || '?';
}

function parseDate(s: string): number {
  const m = s.match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return 0;
  const mon = MONTHS.indexOf(m[1]);
  return new Date(Number(m[3]), mon < 0 ? 0 : mon, Number(m[2])).getTime();
}
const DAY = 86_400_000;

// Start-of-week (Sunday) in ms for a timestamp — the bucket key the tonality
// time-bar groups by. Exported via mentionWeekStart so a tapped bar can filter
// posts back to its week.
function weekStartMs(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime();
}
export function mentionWeekStart(m: SocialMention): number | null {
  const t = parseDate(m.date);
  return t > 0 ? weekStartMs(t) : null;
}

// Group mentions by a key function.
function groupBy<K extends string>(ms: SocialMention[], key: (m: SocialMention) => K): Map<K, SocialMention[]> {
  const map = new Map<K, SocialMention[]>();
  for (const m of ms) {
    const k = key(m);
    const arr = map.get(k);
    if (arr) arr.push(m);
    else map.set(k, [m]);
  }
  return map;
}

// ════════════════════════════ KPI cards (§1) ════════════════════════════
export type ExploreKey = 'total' | 'topinf' | 'mostengaging' | 'topentities' | 'dom';
export interface KpiCard {
  key: string;
  label: string;
  value: string;
  isNumber: boolean;
  detail?: string;
  deltaPct: number;
  avatarLetter?: string;
  avatarColor?: string;
  platform?: SocialPlatform;
  explore: ExploreKey;
}

function topHandleByCount(ms: SocialMention[]): { handle: string; count: number } | null {
  const g = groupBy(ms, (m) => m.handle);
  let best: { handle: string; count: number } | null = null;
  for (const [handle, arr] of g) {
    if (!best || arr.length > best.count) best = { handle, count: arr.length };
  }
  return best;
}

export function buildKpiCards(ms: SocialMention[]): KpiCard[] {
  const cards: KpiCard[] = [];

  // 1. Total Results
  cards.push({
    key: 'total',
    label: 'Total Results',
    value: String(ms.length),
    isNumber: true,
    deltaPct: stableDelta('total'),
    explore: 'total',
  });

  // 2. Top Influencer — most posts
  const topInf = topHandleByCount(ms);
  if (topInf) {
    cards.push({
      key: 'topinf',
      label: 'Top Influencer',
      value: topInf.handle,
      isNumber: false,
      detail: `${topInf.count} ${topInf.count === 1 ? 'post' : 'posts'}`,
      deltaPct: stableDelta('topinf'),
      avatarLetter: avatarInitial(topInf.handle),
      avatarColor: '#7c3aed',
      explore: 'topinf',
    });
  }

  // 3. Most Engaging Posts — highest summed engagement
  const byEng = [...groupBy(ms, (m) => m.handle).entries()]
    .map(([handle, arr]) => ({ handle, eng: arr.reduce((s, m) => s + totalEngagement(m), 0) }))
    .sort((a, b) => b.eng - a.eng)[0];
  if (byEng) {
    cards.push({
      key: 'mostengaging',
      label: 'Most Engaging Posts',
      value: byEng.handle,
      isNumber: false,
      detail: `${formatK(byEng.eng)} eng`,
      deltaPct: stableDelta('mostengaging'),
      avatarLetter: avatarInitial(byEng.handle),
      avatarColor: '#7c3aed',
      explore: 'mostengaging',
    });
  }

  // 4. Top Entities — most frequent entity
  const entCounts = new Map<string, number>();
  ms.forEach((m) => m.entities.forEach((e) => entCounts.set(e, (entCounts.get(e) ?? 0) + 1)));
  const topEnt = [...entCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEnt) {
    cards.push({
      key: 'topentities',
      label: 'Top Entities',
      value: topEnt[0],
      isNumber: false,
      detail: `${topEnt[1]} ${topEnt[1] === 1 ? 'post' : 'posts'}`,
      deltaPct: stableDelta('topentities'),
      avatarLetter: avatarInitial(topEnt[0]),
      avatarColor: '#7c3aed',
      explore: 'topentities',
    });
  }

  // 5–10. Most Dominant per platform
  for (const p of PLATFORM_ORDER) {
    const platMs = ms.filter((m) => m.platform === p);
    const top = topHandleByCount(platMs);
    cards.push({
      key: `dom-${p}`,
      label: `Most Dominant - ${PLATFORM_LABEL[p]}`,
      value: top ? top.handle : '—',
      isNumber: false,
      detail: top ? `${top.count} ${top.count === 1 ? 'post' : 'posts'}` : 'No data',
      deltaPct: stableDelta(`dom-${p}`),
      avatarLetter: top ? avatarInitial(top.handle) : '–',
      avatarColor: PLATFORM_COLOR[p],
      platform: p,
      explore: 'dom',
    });
  }

  return cards;
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

// ════════════════════════════ Timeline (§2) ════════════════════════════
export interface TimelinePoint {
  date: string; // "D. Mon"
  fullDate: string; // "Mon D, YYYY"
  results: number;
  storyValue: number;
  projAvg: number;
  band: [number, number];
}

export function buildTimeline(ms: SocialMention[]): TimelinePoint[] {
  const times = ms.map((m) => parseDate(m.date)).filter((t) => t > 0);
  const end = times.length ? Math.max(...times) : Date.now();
  const WINDOW = 30;
  // bucket counts + story-value sums per day
  const results: number[] = new Array(WINDOW).fill(0);
  const svSum: number[] = new Array(WINDOW).fill(0);
  ms.forEach((m) => {
    const t = parseDate(m.date);
    if (!t) return;
    const idx = WINDOW - 1 - Math.round((end - t) / DAY);
    if (idx >= 0 && idx < WINDOW) {
      results[idx] += 1;
      svSum[idx] += storyValue(m);
    }
  });
  const pts: TimelinePoint[] = [];
  for (let i = 0; i < WINDOW; i++) {
    const d = new Date(end - (WINDOW - 1 - i) * DAY);
    const sv = svSum[i];
    // trailing 7-day mean of story value → projected average line
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      sum += svSum[k];
      cnt++;
    }
    const proj = cnt ? sum / cnt : 0;
    pts.push({
      date: `${d.getDate()}. ${MONTHS[d.getMonth()]}`,
      fullDate: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
      results: results[i],
      storyValue: sv,
      projAvg: proj,
      band: [Math.max(0, proj * 0.7), proj * 1.3 + 0.5],
    });
  }
  return pts;
}

// ════════════════════════ Platform Exposure (§3) ════════════════════════
export interface PlatformShare {
  platform: SocialPlatform;
  label: string;
  count: number;
  color: string;
}
export function buildExposure(ms: SocialMention[]): PlatformShare[] {
  return PLATFORM_ORDER.map((p) => ({
    platform: p,
    label: PLATFORM_LABEL[p],
    count: ms.filter((m) => m.platform === p).length,
    color: EXP_COLOR[p],
  })).filter((x) => x.count > 0);
}

// ════════════════════════ Channel summary cards (§4) ════════════════════════
export interface ChannelCard {
  platform: SocialPlatform;
  label: string;
  color: string;
  stats: { label: string; value: string; zero?: boolean }[];
}
export function buildChannels(ms: SocialMention[]): ChannelCard[] {
  return PLATFORM_ORDER.map((p) => {
    const arr = ms.filter((m) => m.platform === p);
    if (arr.length === 0) return null;
    const sum = (f: (m: SocialMention) => number) => arr.reduce((s, m) => s + f(m), 0);
    const avgInf = arr.reduce((s, m) => s + (parseInt(m.influencerScore ?? '0', 10) || 0), 0) / arr.length;
    const sv = sum((m) => storyValue(m));
    const likes = sum((m) => ('likes' in m.engagement ? (m.engagement as any).likes : 0));
    const comments = sum((m) => ('comments' in m.engagement ? (m.engagement as any).comments : 0));
    const views = sum((m) => ('views' in m.engagement ? (m.engagement as any).views : 0));
    const stats: ChannelCard['stats'] = [
      { label: 'Total Posts', value: String(arr.length) },
      { label: 'Avg. Inf. Score', value: avgInf.toFixed(1), zero: avgInf === 0 },
      { label: 'Total Story Value', value: sv.toFixed(1), zero: sv === 0 },
    ];
    if (likes) stats.push({ label: 'Total Likes', value: formatK(likes) });
    if (comments) stats.push({ label: 'Comments', value: formatK(comments) });
    if (views) stats.push({ label: 'Total Views', value: formatK(views) });
    return { platform: p, label: PLATFORM_LABEL[p], color: PLATFORM_COLOR[p], stats };
  }).filter(Boolean) as ChannelCard[];
}

// ════════════════════════ Tonality (§5) ════════════════════════
export interface TonalitySlice {
  sentiment: Sentiment;
  label: string;
  value: number;
  color: string;
}
export function buildTonalityDonut(ms: SocialMention[]): TonalitySlice[] {
  return (['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => ({
    sentiment: s,
    label: SENTIMENT_LABEL[s],
    value: ms.filter((m) => m.sentiment === s).length,
    color: SENTIMENT_COLOR[s],
  }));
}
export interface TonalityDay {
  label: string;
  start: number; // week-start ms — so a tapped bar can filter to its week
  positive: number;
  neutral: number;
  negative: number;
}
// Bucket mentions into calendar weeks (week start = Sunday) so several posts
// land in the same bar and the sentiment segments stack — matching the web's
// stacked tonality time-bar rather than one thin bar per exact date.
export function buildTonalityTimeline(ms: SocialMention[], limit = 5): TonalityDay[] {
  const dated = ms.filter((m) => parseDate(m.date) > 0);
  if (dated.length === 0) return [];

  const g = new Map<number, { positive: number; neutral: number; negative: number }>();
  dated.forEach((m) => {
    const k = weekStartMs(parseDate(m.date));
    const e = g.get(k) ?? { positive: 0, neutral: 0, negative: 0 };
    e[m.sentiment] += 1;
    g.set(k, e);
  });

  return [...g.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-limit)
    .map(([k, counts]) => {
      const d = new Date(k);
      return { label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, start: k, ...counts };
    });
}

// ════════════════════════ Frequency (§6) ════════════════════════
export function buildFrequency(ms: SocialMention[]): { label: string; value: number }[] {
  const buckets = new Array(11).fill(0);
  ms.forEach((m) => {
    const b = Math.max(0, Math.min(10, Math.floor(storyValue(m))));
    buckets[b] += 1;
  });
  return buckets.map((value, i) => ({ label: String(i), value }));
}

// ════════════════════════ Top Media Sources swimlane (§7a) ════════════════════════
export interface SwimlaneData {
  lanes: { platform: SocialPlatform; label: string; color: string; count: number }[];
  dots: { lane: number; t: number; jitter: number; color: string }[];
  dayLabels: string[];
}
export function buildSwimlane(ms: SocialMention[]): SwimlaneData {
  const present = PLATFORM_ORDER.filter((p) => ms.some((m) => m.platform === p));
  const lanesByCount = present
    .map((p) => ({ platform: p, label: PLATFORM_LABEL[p], color: TMS_COLOR[p], count: ms.filter((m) => m.platform === p).length }))
    .sort((a, b) => b.count - a.count);
  const laneIndex = new Map(lanesByCount.map((l, i) => [l.platform, i]));

  const times = ms.map((m) => parseDate(m.date)).filter((t) => t > 0);
  const max = times.length ? Math.max(...times) : 1;
  // Cap the window so a single old post can't stretch the axis across months —
  // show the most recent ~8 weeks and clamp anything older to the left edge.
  const WINDOW_DAYS = 56;
  const rawMin = times.length ? Math.min(...times) : 0;
  const min = Math.max(rawMin, max - WINDOW_DAYS * DAY);
  const span = Math.max(1, max - min);

  const dots = ms
    .filter((m) => parseDate(m.date) > 0)
    .map((m, i) => {
      const h = ((i + 1) * 2654435761 + hashString(m.url) * 40503) >>> 0;
      return {
        lane: laneIndex.get(m.platform) ?? 0,
        t: Math.max(0, Math.min(1, (parseDate(m.date) - min) / span)),
        jitter: ((h >>> 15) % 13) - 6,
        color: TMS_COLOR[m.platform],
      };
    });

  // ~5 day labels across the span
  const dayLabels: string[] = [];
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const d = new Date(min + (span * i) / (steps - 1));
    dayLabels.push(`${MONTHS[d.getMonth()]} ${d.getDate()}`);
  }
  return { lanes: lanesByCount, dots, dayLabels };
}

// ════════════════════════ Influencer Story Value (§7b) ════════════════════════
export interface InfluencerPoint {
  name: string;
  handle: string;
  platform: SocialPlatform;
  posts: number;
  sv: number;
  score: number; // 0–10 → bubble size
  color: string;
}
export function buildInfluencerDistribution(ms: SocialMention[], infs: InfluencerStat[]): InfluencerPoint[] {
  return infs
    .map((inf) => {
      const theirs = ms.filter((m) => m.handle === inf.handle);
      const posts = theirs.length || 1;
      const sv = theirs.reduce((s, m) => s + storyValue(m), 0) || inf.engagementScore / 150;
      return {
        name: inf.name,
        handle: inf.handle,
        platform: inf.platform,
        posts,
        sv,
        score: Math.max(0, Math.min(10, inf.engagementScore / 100)),
        color: PLATFORM_CHART_COLOR[inf.platform],
      };
    })
    .sort((a, b) => b.posts - a.posts);
}

// ════════════════════════ Media Source Distribution (§8) ════════════════════════
export interface MediaSourcePoint {
  platform: SocialPlatform;
  label: string;
  postCount: number;
  storyValue: number;
  color: string;
}
export function buildMediaSourceDistribution(ms: SocialMention[]): MediaSourcePoint[] {
  return PLATFORM_ORDER.map((p) => {
    const arr = ms.filter((m) => m.platform === p);
    if (arr.length === 0) return null;
    const sv = arr.reduce((s, m) => s + storyValue(m), 0) / arr.length;
    return { platform: p, label: PLATFORM_LABEL[p], postCount: arr.length, storyValue: sv, color: MEDIA_SOURCE_COLOR[p] };
  }).filter(Boolean) as MediaSourcePoint[];
}

// ════════════════════════ Entities Map (§9) ════════════════════════
export interface EntityTileData {
  name: string;
  value: number; // % share
  color: string;
}
export function buildEntitiesMap(ms: SocialMention[], topN = 7): EntityTileData[] {
  const counts = new Map<string, number>();
  ms.forEach((m) => m.entities.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  const total = sorted.reduce((s, [, c]) => s + c, 0) || 1;
  return sorted.map(([name, c], i) => ({ name, value: (c / total) * 100, color: seriesColor(i) }));
}

// ════════════════════════ Top Influencers (section + Explore §10) ════════════════════════
export interface TopInfluencerRow {
  name: string;
  handle: string;
  platform: SocialPlatform;
  posts: number;
  followers: number;
  engagementScore: number;
  color: string;
}
export function buildTopInfluencers(ms: SocialMention[], infs: InfluencerStat[]): TopInfluencerRow[] {
  return infs
    .map((inf) => ({
      name: inf.name,
      handle: inf.handle,
      platform: inf.platform,
      posts: ms.filter((m) => m.handle === inf.handle).length,
      followers: inf.followers,
      engagementScore: inf.engagementScore,
      color: PLATFORM_CHART_COLOR[inf.platform],
    }))
    .sort((a, b) => b.followers - a.followers);
}

// ════════════════════════ Bundle ════════════════════════
export interface DashboardData {
  kpis: KpiCard[];
  timeline: TimelinePoint[];
  exposure: PlatformShare[];
  channels: ChannelCard[];
  tonalityDonut: TonalitySlice[];
  tonalityTimeline: TonalityDay[];
  frequency: { label: string; value: number }[];
  swimlane: SwimlaneData;
  influencerDist: InfluencerPoint[];
  mediaSource: MediaSourcePoint[];
  entities: EntityTileData[];
  topInfluencers: TopInfluencerRow[];
}

export function buildDashboard(
  ms: SocialMention[] = socialMentions,
  infs: InfluencerStat[] = INFLUENCERS,
): DashboardData {
  return {
    kpis: buildKpiCards(ms),
    timeline: buildTimeline(ms),
    exposure: buildExposure(ms),
    channels: buildChannels(ms),
    tonalityDonut: buildTonalityDonut(ms),
    tonalityTimeline: buildTonalityTimeline(ms),
    frequency: buildFrequency(ms),
    swimlane: buildSwimlane(ms),
    influencerDist: buildInfluencerDistribution(ms, infs),
    mediaSource: buildMediaSourceDistribution(ms),
    entities: buildEntitiesMap(ms),
    topInfluencers: buildTopInfluencers(ms, infs),
  };
}
