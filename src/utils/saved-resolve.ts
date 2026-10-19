// Resolve a saved/bookmarked URL against ALL workspaces' datasets, so the
// shared Bookmarks and Saved Articles screens render MediaWatch articles,
// AdWatch ads and SharedView social posts side by side. URLs are unique across
// datasets, so a single URL-keyed save set stays unambiguous.
import { adwatchAds } from '@/data/adwatch-ads';
import { newsArticles } from '@/data/mediawatch-articles';
import type { NewsArticle } from '@/data/mediawatch-types';
import { socialMentions } from '@/data/sample-data';
import type { SocialMention } from '@/data/types';

export type SavedItem =
  | { url: string; kind: 'social'; social: SocialMention }
  | { url: string; kind: 'article'; article: NewsArticle };

const socialByUrl = new Map(socialMentions.map((m) => [m.url, m]));
// AdWatch ads use the same NewsArticle shape, so they render through the
// same 'article' saved-item branch as MediaWatch news articles.
const articleByUrl = new Map([...newsArticles, ...adwatchAds].map((a) => [a.url, a]));

export function resolveSavedUrl(url: string): SavedItem | null {
  const s = socialByUrl.get(url);
  if (s) return { url, kind: 'social', social: s };
  const a = articleByUrl.get(url);
  if (a) return { url, kind: 'article', article: a };
  return null;
}

export function resolveSavedUrls(urls: string[]): SavedItem[] {
  const out: SavedItem[] = [];
  for (const url of urls) {
    const item = resolveSavedUrl(url);
    if (item) out.push(item);
  }
  return out;
}
