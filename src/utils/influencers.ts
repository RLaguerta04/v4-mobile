// Influencers are derived from the social feed: every distinct handle in
// `socialMentions` is an influencer, with their own posts, metrics and
// entities. Mirrors the web Influencers page (buildAuthors), but keyed by
// social handle and computed from real per-influencer posts rather than a
// global feed.
import { TimelinePoint } from '@/data/dashboard-metrics';
import { socialMentions } from '@/data/sample-data';
import { SocialMention, SocialPlatform } from '@/data/types';

// Parse a compact audience figure ("226K", "1.2M", "3,420K") to a number.
export function parseCompact(s?: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/,/g, '').trim();
  const m = /^([\d.]+)\s*([km]?)/i.exec(cleaned);
  if (!m) return 0;
  const mult = m[2].toLowerCase() === 'm' ? 1e6 : m[2].toLowerCase() === 'k' ? 1e3 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

// Number → compact display ("226K", "1.2M"), matching the web's fmtCount.
export function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(n)}`;
}

export interface Influencer {
  name: string; // display name (author)
  handle: string;
  platform: SocialPlatform;
  posts: SocialMention[];
  postCount: number;
  influencerScore: number; // 0–100 — the account's clout
  engagementScore: number; // 0–100 — how engaging their posts are (avg engScore)
  followers: number;
  totalReach: number; // sum of estimated reach across their posts
}

export type InfluencerSort = 'score' | 'posts' | 'reach' | 'az';

export const INFLUENCER_SORTS: { key: InfluencerSort; label: string }[] = [
  { key: 'score', label: 'Highest Influencer Score' },
  { key: 'posts', label: 'Most Posts' },
  { key: 'reach', label: 'Highest Reach' },
  { key: 'az', label: 'Name (A–Z)' },
];

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  twitter: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  tiktok: 'TikTok',
};
export function platformLabel(p: SocialPlatform): string {
  return PLATFORM_LABEL[p];
}

function avg(ns: number[]): number {
  return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0;
}

export function buildInfluencers(): Influencer[] {
  const map = new Map<string, SocialMention[]>();
  for (const m of socialMentions) {
    const arr = map.get(m.handle);
    if (arr) arr.push(m);
    else map.set(m.handle, [m]);
  }
  const list: Influencer[] = [];
  map.forEach((posts, handle) => {
    const first = posts[0];
    const influencerScore = Math.round(
      avg(posts.map((p) => parseInt(p.influencerScore ?? '0', 10) || 0)),
    );
    const engagementScore = Math.round(avg(posts.map((p) => p.engScore ?? 0)));
    const followers = parseCompact(first.followers);
    const totalReach = posts.reduce((s, p) => s + parseCompact(p.estReach), 0);
    list.push({
      name: first.author ?? handle,
      handle,
      platform: first.platform,
      posts,
      postCount: posts.length,
      influencerScore,
      engagementScore,
      followers,
      totalReach,
    });
  });
  return list;
}

export function sortInfluencers(list: Influencer[], sort: InfluencerSort): Influencer[] {
  const out = [...list];
  if (sort === 'posts') {
    out.sort((a, b) => b.postCount - a.postCount || b.influencerScore - a.influencerScore);
  } else if (sort === 'reach') {
    out.sort((a, b) => b.totalReach - a.totalReach);
  } else if (sort === 'az') {
    out.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    out.sort((a, b) => b.influencerScore - a.influencerScore);
  }
  return out;
}

// Entities aggregated across an influencer's posts, with hit counts (desc).
export interface EntityCount {
  name: string;
  count: number;
}
export function influencerEntities(inf: Influencer): EntityCount[] {
  const map = new Map<string, number>();
  for (const p of inf.posts) {
    for (const e of p.entities) map.set(e, (map.get(e) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface SentimentSplit {
  positive: number;
  neutral: number;
  negative: number;
}
export function sentimentSplit(inf: Influencer): SentimentSplit {
  const s: SentimentSplit = { positive: 0, neutral: 0, negative: 0 };
  for (const p of inf.posts) s[p.sentiment]++;
  return s;
}

// Field-wide averages, so a single influencer can be read against the pack
// in the Performance tab (meaningful even for a one-post influencer).
export interface InfluencerField {
  avgScore: number;
  avgEngagement: number;
  avgFollowers: number;
  maxFollowers: number;
}
export function influencerField(list: Influencer[]): InfluencerField {
  return {
    avgScore: Math.round(avg(list.map((i) => i.influencerScore))),
    avgEngagement: Math.round(avg(list.map((i) => i.engagementScore))),
    avgFollowers: Math.round(avg(list.map((i) => i.followers))),
    maxFollowers: Math.max(1, ...list.map((i) => i.followers)),
  };
}

// ── Performance tab: a per-influencer trend series for the shared BarLineChart
// (story-value band + result bars + projected-average line), mirroring the web
// Influencers "Performance Charts". Deterministically hash-seeded from the
// handle so each influencer gets a stable, lively chart, in the positive
// convention BarLineChart expects. Changing the range pill reshapes the window.
export const PERF_RANGES: { days: number; label: string }[] = [
  { days: 3, label: '3D' },
  { days: 7, label: '7D' },
  { days: 15, label: '15D' },
  { days: 30, label: '1M' },
];

const PERF_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERF_END = new Date(2026, 6, 27).getTime(); // Jul 27, 2026 — the feed's "as of" date
const PERF_DAY = 86_400_000;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

export function buildInfluencerPerformance(inf: Influencer, days: number): TimelinePoint[] {
  const sv: number[] = [];
  const results: number[] = [];
  for (let i = 0; i < days; i++) {
    const h = hashStr(`${inf.handle}#${i}`);
    sv.push(Math.round(((h % 620) / 100 + 0.3) * 10) / 10); // ~0.3–6.5, one decimal
    results.push((h >>> 5) % 4); // 0–3 results that day
  }
  const pts: TimelinePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(PERF_END - (days - 1 - i) * PERF_DAY);
    // trailing 7-day mean → the projected-average line
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      sum += sv[k];
      cnt++;
    }
    const proj = cnt ? sum / cnt : 0;
    const s = sv[i];
    pts.push({
      date: `${d.getDate()}. ${PERF_MONTHS[d.getMonth()]}`,
      fullDate: `${PERF_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
      results: results[i],
      storyValue: s,
      projAvg: proj,
      band: [Math.max(0, s - 1.4), s + 1.4],
    });
  }
  return pts;
}
