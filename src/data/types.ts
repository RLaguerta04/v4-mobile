import type { ImageSourcePropType } from 'react-native';

export type Sentiment = 'positive' | 'neutral' | 'negative';

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
