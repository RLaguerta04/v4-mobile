// Article-workspace config — the single source of per-view differences between
// the two article workspaces, MediaWatch (news articles) and AdWatch (paid ad
// placements). Both share the exact same screens/components (mentions, dashboard,
// brief, reports, search, tracker, filters); each screen reads this config via
// useArticleWorkspace() instead of importing a dataset directly, so AdWatch is
// MediaWatch driven by a different dataset + a handful of labels. SharedView
// (social) is a separate branch entirely and does not use this.
//
// Web parity: in the reference, AdWatch loads an empty data-adwatch.js and all
// its differences are runtime `WS==='adwatch'` branches in app.js — the same
// "one engine, config-driven" shape this module encodes.
import { useMemo } from 'react';

import { AppView, useAuth, VIEW_ACCENT_COLORS } from '@/contexts/auth-context';
import {
  adwatchAds,
  adwatchActivities,
  adwatchReports,
  adwatchTrending,
} from '@/data/adwatch-ads';
import {
  mediawatchActivities,
  mediawatchReports,
  mediawatchTrending,
  newsArticles,
} from '@/data/mediawatch-articles';
import type { MediaType, MediaWatchReport, NewsArticle } from '@/data/mediawatch-types';
import type { TrackerActivity, TrendingStory } from '@/data/types';

// A selectable media channel: a display label + the raw media types that roll
// up under it. MediaWatch rolls Online/TV/Print/Radio; AdWatch exposes only the
// three ad sources (Video = TV spots, Print, Radio), with Online excluded.
export interface WorkspaceChannel {
  label: string;
  types: MediaType[];
}

const PRINT_TYPES: MediaType[] = ['broadsheet', 'provincial', 'tabloid', 'magazine'];

const MEDIAWATCH_CHANNELS: WorkspaceChannel[] = [
  { label: 'Online', types: ['online', 'blog'] },
  { label: 'TV', types: ['tv'] },
  { label: 'Print', types: PRINT_TYPES },
  { label: 'Radio', types: ['radio'] },
];

// AdWatch: three ad sources. "Video" maps to TV spots; Online is excluded.
const ADWATCH_CHANNELS: WorkspaceChannel[] = [
  { label: 'Video', types: ['tv'] },
  { label: 'Print', types: PRINT_TYPES },
  { label: 'Radio', types: ['radio'] },
];

export interface ArticleWorkspace {
  view: Extract<AppView, 'MediaWatch' | 'AdWatch'>;
  /** AdWatch = ads; flips media labels, nouns, brief tiering and the dashboard. */
  adMode: boolean;
  /** Brand accent for this workspace (KPI avatars, chips, buttons). */
  accent: string;
  // Display nouns for the covered item — "article(s)" vs "ad(s)".
  noun: string;
  nouns: string;
  Noun: string;
  Nouns: string;
  // Datasets (re-dated to "now" at their source modules).
  articles: NewsArticle[];
  activities: TrackerActivity[];
  reports: MediaWatchReport[];
  trending: TrendingStory[];
  /** Selectable media channels for the filter sheet + dashboard chips. */
  channels: WorkspaceChannel[];
  /** AdWatch dashboard = KPIs + the single "Ad Spend" timeline only. */
  minimalDashboard: boolean;
  /** Timeline card title — "Timeline" (MediaWatch) vs "Ad Spend" (AdWatch). */
  timelineTitle: string;
  /** MediaWatch shows Tier 1 spotlight/flagged framing; AdWatch has none. */
  spotlightTier: boolean;
}

const MEDIAWATCH_WORKSPACE: ArticleWorkspace = {
  view: 'MediaWatch',
  adMode: false,
  accent: VIEW_ACCENT_COLORS.MediaWatch,
  noun: 'article',
  nouns: 'articles',
  Noun: 'Article',
  Nouns: 'Articles',
  articles: newsArticles,
  activities: mediawatchActivities,
  reports: mediawatchReports,
  trending: mediawatchTrending,
  channels: MEDIAWATCH_CHANNELS,
  minimalDashboard: false,
  timelineTitle: 'Timeline',
  spotlightTier: true,
};

const ADWATCH_WORKSPACE: ArticleWorkspace = {
  view: 'AdWatch',
  adMode: true,
  accent: VIEW_ACCENT_COLORS.AdWatch,
  noun: 'ad',
  nouns: 'ads',
  Noun: 'Ad',
  Nouns: 'Ads',
  articles: adwatchAds,
  activities: adwatchActivities,
  reports: adwatchReports,
  trending: adwatchTrending,
  channels: ADWATCH_CHANNELS,
  minimalDashboard: true,
  timelineTitle: 'Ad Spend',
  spotlightTier: false,
};

/** The two article workspaces; SharedView (social) is handled separately. */
export function isArticleView(view: AppView | null): boolean {
  return view === 'MediaWatch' || view === 'AdWatch';
}

export function getWorkspace(view: AppView | null): ArticleWorkspace {
  return view === 'AdWatch' ? ADWATCH_WORKSPACE : MEDIAWATCH_WORKSPACE;
}

/** The active article workspace, resolved from auth's activeView. */
export function useArticleWorkspace(): ArticleWorkspace {
  const { activeView } = useAuth();
  return useMemo(() => getWorkspace(activeView), [activeView]);
}

// ── Channel helpers (shared by the filter sheet + dashboard) ──

/** Is this article in the given channel (by media type)? */
export function articleInChannel(a: NewsArticle, channel: WorkspaceChannel): boolean {
  return channel.types.includes(a.mediaType);
}

/** The channel label an article falls under within a workspace, or null. */
export function channelLabelOf(a: NewsArticle, channels: WorkspaceChannel[]): string | null {
  return channels.find((c) => c.types.includes(a.mediaType))?.label ?? null;
}
