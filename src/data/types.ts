import type { ImageSourcePropType } from 'react-native';

export type Sentiment = 'positive' | 'neutral' | 'negative';

// Editorial tone of the post, distinct from brand sentiment: "mixed" is the
// tone equivalent of a neutral slant (the SharedView Post Tone selector).
export type ArticleTone = 'positive' | 'mixed' | 'negative';

interface BaseMention {
  handle: string;
  post: string;
  sentiment: Sentiment;
  date: string;
  ago: string;
  // When this mention's engagement numbers were last scraped — shown near
  // the engagement row since it qualifies those counts, not the post itself.
  capturedAt: string;
  entities: string[];
  url: string;

  // ── Post-detail fields ──
  // Shown in the expanded "Mention Details" view, ported from the SharedView
  // social panel (v4-client/shared/mentions.html → renderSocialDetail). Optional
  // so each section only renders when its data is present; authored as static
  // prototype values — swap for a real API later, same as the posts above.
  /** Estimated audience reach, pre-formatted (e.g. "6.2K"). */
  estReach?: string;
  /** Engagement score (0–100). */
  engScore?: number;
  /** Post type — "Text" | "Photo" | "Video". */
  type?: string;
  /** Influencer display name shown in the Influencer card. */
  author?: string;
  /** Influencer score, pre-formatted (e.g. "28"). */
  influencerScore?: string;
  /** Follower count, pre-formatted (e.g. "61K"). */
  followers?: string;
  /** Post tone — editorial slant, distinct from brand sentiment. */
  tone?: ArticleTone;
  /** Keyword hits as [term, count] pairs. */
  keywords?: [string, number][];
}

// Engagement shape is discriminated by platform, so each platform only ever
// carries the metrics it actually has (e.g. Instagram has no "views").
// `thumb` is optional everywhere except Instagram — a real Instagram post is
// never text-only, so it's required there at the type level, not just by
// convention in the sample data.
export type SocialMention =
  | (BaseMention & {
      platform: 'facebook';
      thumb?: ImageSourcePropType;
      engagement: { likes: number; comments: number; shares: number };
    })
  | (BaseMention & {
      platform: 'twitter';
      thumb?: ImageSourcePropType;
      engagement: { likes: number; replies: number; reposts: number; views: number };
    })
  | (BaseMention & {
      platform: 'instagram';
      thumb: ImageSourcePropType;
      engagement: { likes: number; comments: number };
    })
  | (BaseMention & {
      platform: 'youtube';
      thumb?: ImageSourcePropType;
      engagement: { likes: number; comments: number; views: number };
    })
  | (BaseMention & {
      platform: 'tiktok';
      thumb?: ImageSourcePropType;
      engagement: { likes: number; comments: number; shares: number; views: number };
    })
  | (BaseMention & {
      platform: 'reddit';
      thumb?: ImageSourcePropType;
      engagement: { upvotes: number; comments: number; awards?: number };
    });

export type SocialPlatform = SocialMention['platform'];

export interface InfluencerStat {
  name: string;
  handle: string;
  platform: SocialPlatform;
  followers: number;
  engagementScore: number;
}

export type ActivityType = 'Press Release' | 'Crisis' | 'Product' | 'Trending' | 'Event';
export type TrackerMedia = 'Online' | 'TV' | 'Print' | 'Radio';

// A single piece of matched coverage inside a tracker activity (web parity:
// acts[].matches) — an authored news-article pickup.
export interface TrackerMatch {
  source: string; // publisher, e.g. 'BusinessWorld'
  media: TrackerMedia;
  title: string; // article headline
  date: string; // 'Jun 22, 2026'
  value: number; // AVE in PHP
  score: number; // similarity, 0–1
}

// A tracked "activity" for the Activity Tracker (web parity: tracker acts).
// Carries its own authored matched coverage; count / value / avg similarity are
// derived from `matches`.
export interface TrackerActivity {
  id: number;
  title: string;
  type: ActivityType;
  date: string; // 'May 18, 2026'
  description: string;
  matches: TrackerMatch[];
}

// A clustered "trending story" for Today's Brief (web parity: trendStories).
// Only the narrative is authored — a story's member posts are the mentions
// tagged with any of its `entities`, and post count / value / sentiment are
// derived from those members.
export interface TrendingStory {
  rank: number;
  tier: 'T1' | 'T2';
  title: string;
  why: string;
  entities: string[];
}
