// MediaWatch (news-article) data model. This workspace monitors articles
// collected from news outlets/websites — distinct from SharedView's social
// posts (see SocialMention in ./types). Kept in its own module so the two
// workspaces never share a data source. `entities` carries the same bucket
// names used by SocialMention (see taxonomy.ts) so the shared category filter
// works identically, plus free-form org/person entities for the Entities tab.
import type { ArticleTone, Sentiment } from './types';

// Medium the article ran in — drives the headline icon + media filter.
// Mirrors the web reference's ARTICLE_TYPES.
export type MediaType =
  | 'online'
  | 'tv'
  | 'radio'
  | 'broadsheet'
  | 'provincial'
  | 'tabloid'
  | 'magazine'
  | 'blog';

// The four coarse channels the Dashboard/Tracker group by (Online rolls up
// online + blog; Print rolls up broadsheet/provincial/tabloid/magazine).
export type MediaChannel = 'Online' | 'TV' | 'Print' | 'Radio';

export interface NewsArticle {
  id: string;
  title: string;
  /** Full publication name, e.g. "Philippine Daily Inquirer" (grouping key for Publishers). */
  outlet: string;
  /** Short label, e.g. "Inquirer". */
  outletShort?: string;
  /** Desk/section, e.g. "Business" | "Motoring" | "Technology". */
  section: string;
  author: string;
  /** Absolute publish date, e.g. "Jul 25, 2026". */
  date: string;
  /** Relative recency, e.g. "14h ago". */
  ago: string;
  /** AVE in PHP, numeric (format with formatAve). */
  ave: number;
  /** Story Value, 0–10. */
  storyValue: number;
  /** Brand sentiment — drives the sentiment pill. */
  sentiment: Sentiment;
  /** Editorial tone, distinct from brand sentiment. */
  tone: ArticleTone;
  mediaType: MediaType;
  /** 9-point daily coverage-volume sparkline (web parity: `chart`). */
  chart: number[];
  /** Keyword hits as [term, count] pairs. */
  keywords: [string, number][];
  /** Bucket names (for the category filter) + named orgs/people (for Entities). */
  entities: string[];
  url: string;
  /** Article body/snippet shown in the detail reader. */
  summary?: string;
  /** Per-article author score shown in the reader's Author card. */
  authorScore?: number;

  // ── Broadcast extras (tv/radio) ──
  program?: string;
  segment?: string;
  length?: string;
  aired?: string;
  transcript?: string;

  // ── Print extras ──
  page?: string;
}

// A publisher or author row — an aggregation computed from newsArticles
// (see mediawatch-metrics.buildPublishers / buildAuthors). Both use the same
// shape; only the grouping key and the score label ("Pub Score" vs "Author
// Score") differ. `score` = avg Story Value × 2 (web reference formula).
export interface EntityStat {
  name: string;
  count: number;
  totalSV: number;
  totalAve: number;
  score: number;
  sentimentSplit: { positive: number; neutral: number; negative: number };
  /** The articles belonging to this entity, newest-first. */
  articles: NewsArticle[];
}

export type ReportFrequency = 'Weekly' | 'Monthly' | 'Annually';

export interface MediaWatchReport {
  id: string;
  name: string;
  frequency: ReportFrequency;
  /** e.g. "Coverage Summary" | "Executive Brief" | "Aggregated Data". */
  type: string;
  /** Coverage period, e.g. "Jul 2026" or "Week 30". */
  period: string;
  ave: number;
  reach: number;
  storyValue: number;
  /** Where "View Report" opens (an external report artifact). */
  url?: string;
}
