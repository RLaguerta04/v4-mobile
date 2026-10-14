// Derived-metric helpers for the Activity Tracker. Activities author their
// matched coverage (news-article pickups); everything numeric here is computed
// from those matches.
import { socialMentions } from '@/data/sample-data';
import { SocialMention, TrackerActivity, TrackerMatch, TrackerMedia } from '@/data/types';

// Format a PHP AVE total: 1,414,000 → "PHP 1.4M", 78,000 → "PHP 78K", 0 → "PHP 0".
export function formatPhp(n: number): string {
  if (n >= 1_000_000) return `PHP ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `PHP ${Math.round(n / 1_000)}K`;
  return `PHP ${Math.round(n)}`;
}

export interface ResolvedActivity extends TrackerActivity {
  // matches, sorted by similarity (desc)
  matchCount: number;
  value: string; // formatted PHP total
  avgMatch: number; // average similarity, 0–100
}

export function resolveActivity(activity: TrackerActivity): ResolvedActivity {
  const matches = [...activity.matches].sort((a, b) => b.score - a.score);
  const total = matches.reduce((s, m) => s + m.value, 0);
  const avgMatch = matches.length
    ? Math.round((matches.reduce((s, m) => s + m.score, 0) / matches.length) * 100)
    : 0;
  return { ...activity, matches, matchCount: matches.length, value: formatPhp(total), avgMatch };
}

// The feed posts that belong to an activity: those whose entities/keywords are
// named in its title or description, padded (seeded by title) to at least a few
// so a tracked story always shows coverage. Empty for activities with no matches.
export function postsForActivity(activity: TrackerActivity): SocialMention[] {
  if (!activity.matches.length) return [];
  const hay = `${activity.title} ${activity.description}`.toLowerCase();
  const matched = socialMentions.filter((p) => {
    const terms = [...p.entities, ...(p.keywords ?? []).map(([t]) => t)];
    return terms.some((t) => t.length >= 3 && hay.includes(t.toLowerCase()));
  });
  if (matched.length >= 3) return matched;
  const out = [...matched];
  const seen = new Set(out.map((p) => p.url));
  const h = kwHash(activity.title);
  for (let i = 0; out.length < 3 && i < socialMentions.length; i++) {
    const p = socialMentions[(h + i) % socialMentions.length];
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    out.push(p);
  }
  return out;
}

// ── Timeline tab: how the story spread across media over time ──
export interface TimelineStage {
  key: string;
  kind: 'start' | 'agg' | 'media' | 'total';
  media?: TrackerMedia;
  title: string;
  sub?: string;
  meta?: string;
  posts?: TrackerMatch[];
}

export function buildTimeline(activity: ResolvedActivity): TimelineStage[] {
  const matches = activity.matches;
  const stages: TimelineStage[] = [];
  stages.push({
    key: 'pub',
    kind: 'start',
    title: `${activity.type} published`,
    sub: activity.title,
    meta: activity.date,
  });
  if (!matches.length) return stages;

  const medias = [...new Set(matches.map((m) => m.media))];
  stages.push({
    key: 'agg',
    kind: 'agg',
    title: `${matches.length} media ${matches.length === 1 ? 'pickup' : 'pickups'} detected`,
    sub: `AI-matched across ${medias.length} ${medias.length === 1 ? 'channel' : 'channels'}`,
  });
  medias.forEach((med) => {
    const grp = matches.filter((m) => m.media === med);
    const ave = grp.reduce((s, m) => s + m.value, 0);
    stages.push({
      key: `med-${med}`,
      kind: 'media',
      media: med,
      title: `${grp.length} ${med} ${grp.length === 1 ? 'pickup' : 'pickups'}`,
      meta: `${formatPhp(ave)} AVE`,
      posts: grp,
    });
  });
  const total = matches.reduce((s, m) => s + m.value, 0);
  stages.push({ key: 'total', kind: 'total', title: formatPhp(total), sub: 'Total AVE generated' });
  return stages;
}

// ── Keyword Cloud tab (web parity: KW_CATS + KW_TERMS + computeKeywords) ──
// Seven colour-coded categories; the `color` is the web's primary swatch.
export const KW_CATS: Record<string, { label: string; color: string }> = {
  org: { label: 'Organizations', color: '#6B5CB8' },
  people: { label: 'People', color: '#D946EF' },
  location: { label: 'Locations', color: '#F97316' },
  agency: { label: 'Government Agencies', color: '#0EA5E9' },
  infra: { label: 'Infrastructure', color: '#14B8A6' },
  economy: { label: 'Economy', color: '#16A34A' },
  brand: { label: 'Brands', color: '#EC4899' },
};

export interface Keyword {
  term: string;
  count: number;
  cat: string;
  posts: SocialMention[]; // the feed posts this keyword drills down to
}

// The keyword bank: [label, category, aliases] — BYD / EV / automotive topic.
// Which terms surface comes from scanning the activity's matched articles; each
// term then drills down to the feed posts that mention it (see computeKeywords).
const KW_TERMS: [string, string, string[]][] = [
  ['BYD', 'brand', ['byd']], ['Sealion 7', 'brand', ['sealion 7', 'sealion']], ['Seal 5 DM-i', 'brand', ['seal 5']],
  ['Atto 3', 'brand', ['atto 3']], ['Atto 2', 'brand', ['atto 2']], ['eMAX9', 'brand', ['emax9', 'emax 9']], ['Dolphin', 'brand', ['dolphin']],
  ['Tesla', 'brand', ['tesla', 'model y']], ['Toyota', 'brand', ['toyota', 'camry', 'rav4']], ['Nissan', 'brand', ['nissan', 'leaf']], ['Hyundai', 'brand', ['hyundai', 'ioniq']], ['MG', 'brand', ['mg ']], ['Chery', 'brand', ['chery']], ['GAC', 'brand', ['gac', 'aion']],
  ['EV', 'infra', ['ev ', 'electric vehicle']], ['Charging', 'infra', ['charging', 'charger']], ['Fast Charging', 'infra', ['fast charging', 'fast-charge']], ['Battery', 'infra', ['battery', 'blade battery']], ['Range', 'infra', ['range', 'mileage']],
  ['Plug-in Hybrid', 'infra', ['plug-in hybrid', 'dm-i', 'phev']], ['Dual-motor', 'infra', ['dual-motor', 'dual motor']], ['Suspension', 'infra', ['suspension']], ['Powertrain', 'infra', ['powertrain', 'drivetrain']], ['Software', 'infra', ['software', 'ota', 'update']], ['Safety', 'infra', ['safety', 'recall', 'airbag']], ['Autonomy', 'infra', ['adas', 'autonomous', 'driver assist']],
  ['Pricing', 'economy', ['pricing', 'price']], ['Sales', 'economy', ['sales', 'deliveries']], ['Allocation', 'economy', ['reservation', 'backlog', 'allocation', 'waitlist', 'delivery timeline']], ['Incentives', 'economy', ['incentive', 'subsidy']], ['Investment', 'economy', ['investment', 'invest']], ['Market Share', 'economy', ['market share']], ['Warranty', 'economy', ['warranty']], ['Reliability', 'economy', ['reliability', 'reliable']],
  ['Manila', 'location', ['manila']], ['Cebu', 'location', ['cebu']], ['Cavite', 'location', ['cavite', 'dasma']], ['Davao', 'location', ['davao']], ['La Union', 'location', ['la union']], ['Baguio', 'location', ['baguio']], ['Visayas', 'location', ['visayas']], ['Philippines', 'location', ['philippine']],
  ['Country Manager', 'people', ['country manager']], ['Spokesperson', 'people', ['spokesperson', 'executive']],
  ['EVIDA', 'agency', ['evida']], ['DOE', 'agency', ['department of energy']], ['LTO', 'agency', ['lto', 'land transportation']], ['DTI', 'agency', ['dti', 'trade and industry']], ['BOI', 'agency', ['board of investments']],
  ['Dealership', 'org', ['dealership', 'showroom']], ['Service Center', 'org', ['service center', 'after-sales', 'after sales']], ['ACMobility', 'org', ['acmobility', 'ayala']], ['Test Drive', 'org', ['test drive', 'first drive', 'review']], ['Road Trip', 'org', ['road trip', 'roadtrip']], ['Partnership', 'org', ['partnership', 'partner']],
];

const KW_TARGET = 30; // fill the cloud to ~this many keywords (padded when real hits are few)
function kwHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

// Feed posts whose text, entities, or keyword hits contain any of the aliases.
function postsForAliases(aliases: string[]): SocialMention[] {
  return socialMentions.filter((p) => {
    const hay = `${p.post} ${p.entities.join(' ')} ${(p.keywords ?? [])
      .map(([t]) => t)
      .join(' ')}`.toLowerCase();
    return aliases.some((al) => hay.includes(al));
  });
}

// Deterministic fallback (seeded by the term) so a keyword with no real post
// match still drills to a couple of posts rather than an empty page.
function padPosts(term: string): SocialMention[] {
  const h = kwHash(term);
  const n = Math.min(2 + (h % 2), socialMentions.length); // 2–3 posts
  const start = h % socialMentions.length;
  const out: SocialMention[] = [];
  for (let j = 0; j < n; j++) out.push(socialMentions[(start + j) % socialMentions.length]);
  return out;
}

export function computeKeywords(activity: ResolvedActivity): Keyword[] {
  // No matched coverage → no keyword cloud (keeps the empty state for new activities).
  if (!activity.matches.length) return [];
  const out: Keyword[] = [];
  const have = new Set<string>();
  const add = (label: string, cat: string, aliases: string[]) => {
    const matched = postsForAliases(aliases);
    const posts = matched.length ? matched : padPosts(label);
    out.push({ term: label, cat, count: posts.length, posts });
    have.add(label);
  };
  // 1) Terms that appear in this activity's matched articles surface first.
  KW_TERMS.forEach(([label, cat, aliases]) => {
    const inArticles = activity.matches.some((m) => {
      const hay = `${m.title} ${m.source}`.toLowerCase();
      return aliases.some((al) => hay.includes(al));
    });
    if (inArticles) add(label, cat, aliases);
  });
  // 2) Pad toward KW_TARGET from the rest of the bank.
  for (const [label, cat, aliases] of KW_TERMS) {
    if (out.length >= KW_TARGET) break;
    if (have.has(label)) continue;
    add(label, cat, aliases);
  }
  out.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  return out;
}

export function keywordInsight(activity: ResolvedActivity, keywords: Keyword[]): string {
  if (!keywords.length) return '';
  const top = keywords.slice(0, 3).map((k) => k.term);
  const catCount: Record<string, number> = {};
  keywords.forEach((k) => {
    catCount[k.cat] = (catCount[k.cat] || 0) + 1;
  });
  const domCat = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a])[0];
  const list =
    top.length <= 1 ? top[0] : top.length === 2 ? `${top[0]} and ${top[1]}` : `${top[0]}, ${top[1]} and ${top[2]}`;
  return `Coverage centers on ${list}, with ${keywords[0].term} mentioned most across ${
    activity.matchCount
  } linked ${activity.matchCount === 1 ? 'post' : 'posts'}. The dominant category is ${
    KW_CATS[domCat].label
  }.`;
}
