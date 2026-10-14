// Global search engine — scans every searchable collection in the app and
// returns typed, ranked results. Pure (no hooks/navigation): the Search screen
// passes in the derived/stateful data (influencers, activities, folders) and
// handles opening each result. Matching is partial, case-insensitive, and
// multi-field, with light ranking (prefix > word-start > mid-substring).
import { socialMentions, trendingStories } from '@/data/sample-data';
import { CATEGORY_TAXONOMY } from '@/data/taxonomy';
import { SocialMention, TrackerActivity, TrendingStory } from '@/data/types';
import { Influencer } from '@/utils/influencers';

export type SearchResultType = 'post' | 'influencer' | 'category' | 'activity' | 'folder' | 'trending';

export const RESULT_TYPE_ORDER: SearchResultType[] = [
  'post',
  'influencer',
  'category',
  'activity',
  'folder',
  'trending',
];

interface Base {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  score: number;
}
export interface PostResult extends Base {
  type: 'post';
  mention: SocialMention;
}
export interface InfluencerResult extends Base {
  type: 'influencer';
  influencer: Influencer;
}
export interface CategoryResult extends Base {
  type: 'category';
  category: string;
}
export interface ActivityResult extends Base {
  type: 'activity';
  activity: TrackerActivity;
}
export interface FolderResult extends Base {
  type: 'folder';
  folderId: string;
}
export interface TrendingResult extends Base {
  type: 'trending';
  story: TrendingStory;
}
export type SearchResult =
  | PostResult
  | InfluencerResult
  | CategoryResult
  | ActivityResult
  | FolderResult
  | TrendingResult;

export interface FolderInput {
  id: string;
  name: string;
  count: number;
}
export interface SearchInputs {
  influencers: Influencer[];
  activities: TrackerActivity[];
  folders: FolderInput[];
}

// 3 = prefix, 2 = starts a word, 1 = mid-substring, 0 = no match.
function scoreField(text: string, q: string): number {
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i < 0) return 0;
  if (i === 0) return 3;
  return /[\s@#·—/-]/.test(t[i - 1]) ? 2 : 1;
}
function best(fields: (string | undefined)[], q: string): number {
  let s = 0;
  for (const f of fields) if (f) s = Math.max(s, scoreField(f, q));
  return s;
}
function snippet(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function globalSearch(query: string, inputs: SearchInputs): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: SearchResult[] = [];

  // Posts — text, handle, author, platform, entities, keyword hits.
  for (const m of socialMentions) {
    const kw = (m.keywords ?? []).map(([t]) => t);
    const s = best([m.post, m.handle, m.author, m.platform, ...m.entities, ...kw], q);
    if (s > 0) {
      out.push({ type: 'post', id: `post:${m.url}`, title: m.handle, subtitle: snippet(m.post), score: s, mention: m });
    }
  }
  // Influencers / accounts.
  for (const inf of inputs.influencers) {
    const s = best([inf.name, inf.handle, inf.platform], q);
    if (s > 0) {
      out.push({
        type: 'influencer',
        id: `inf:${inf.handle}`,
        title: inf.name,
        subtitle: `${inf.handle} · ${inf.postCount} ${inf.postCount === 1 ? 'post' : 'posts'}`,
        score: s,
        influencer: inf,
      });
    }
  }
  // Categories + their buckets (+ keyword hits inside a bucket).
  for (const cat of CATEGORY_TAXONOMY) {
    const catScore = scoreField(cat.name, q);
    if (catScore > 0) {
      out.push({
        type: 'category',
        id: `cat:${cat.name}`,
        title: cat.name,
        subtitle: `${cat.buckets.length} buckets`,
        score: catScore,
        category: cat.name,
      });
    }
    for (const b of cat.buckets) {
      const bScore = scoreField(b.name, q);
      const kws = [...b.keywords.main, ...(b.keywords.additional ?? []), ...(b.keywords.related ?? [])];
      const kwHit = kws.find((k) => k.toLowerCase().includes(q));
      if (bScore > 0 || kwHit) {
        out.push({
          type: 'category',
          id: `bucket:${cat.name}:${b.name}`,
          title: b.name,
          subtitle: bScore > 0 ? cat.name : `${cat.name} · ${kwHit}`,
          score: bScore > 0 ? bScore : 1,
          category: cat.name,
        });
      }
    }
  }
  // Tracker activities (+ their matched article sources/titles).
  for (const a of inputs.activities) {
    const s = best(
      [a.title, a.description, a.type, ...a.matches.map((mt) => mt.source), ...a.matches.map((mt) => mt.title)],
      q,
    );
    if (s > 0) {
      out.push({ type: 'activity', id: `act:${a.id}`, title: a.title, subtitle: `${a.type} · ${a.date}`, score: s, activity: a });
    }
  }
  // Saved-article folders.
  for (const f of inputs.folders) {
    const s = scoreField(f.name, q);
    if (s > 0) {
      out.push({ type: 'folder', id: `folder:${f.id}`, title: f.name, subtitle: `${f.count} saved`, score: s, folderId: f.id });
    }
  }
  // Trending stories.
  for (const st of trendingStories) {
    const s = best([st.title, st.why, ...st.entities], q);
    if (s > 0) {
      out.push({ type: 'trending', id: `tr:${st.rank}`, title: st.title, subtitle: snippet(st.why), score: s, story: st });
    }
  }

  return out.sort(
    (a, b) => b.score - a.score || RESULT_TYPE_ORDER.indexOf(a.type) - RESULT_TYPE_ORDER.indexOf(b.type),
  );
}

// Tappable suggestion queries for the empty state: the most-mentioned entities
// plus a couple of category names.
export function searchSuggestions(): string[] {
  const counts = new Map<string, number>();
  for (const m of socialMentions) for (const e of m.entities) counts.set(e, (counts.get(e) ?? 0) + 1);
  const topEntities = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([e]) => e);
  const cats = CATEGORY_TAXONOMY.slice(0, 2).map((c) => c.name);
  return [...topEntities, ...cats];
}
