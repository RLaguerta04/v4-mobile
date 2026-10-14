// Renders a saved/bookmarked item as the right card for its dataset — a social
// MentionCard or a MediaWatch ArticleCard — so the shared Bookmarks and Saved
// Articles screens can show both workspaces' saves.
import { ArticleCard } from '@/components/mediawatch/article-card';
import { MentionCard } from '@/components/mention-card';
import { useBookmarks } from '@/contexts/bookmarks-context';
import type { SavedItem } from '@/utils/saved-resolve';

export function SavedUrlCard({ item }: { item: SavedItem }) {
  const { isSaved, toggleSave } = useBookmarks();
  if (item.kind === 'article') {
    return <ArticleCard article={item.article} />;
  }
  return <MentionCard mention={item.social} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />;
}
