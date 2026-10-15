import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { ArticleFilters } from '@/data/mediawatch-metrics';

export interface ArticleSavedFilter {
  id: number;
  name: string;
  filters: ArticleFilters;
}

// Deep-clone a filter config so a saved preset stays independent of later edits
// to the sheet's pending state (the Sets and date/value ranges are otherwise
// shared references). Mirrors cloneFilters in saved-filters-context.tsx.
export function cloneArticleFilters(f: ArticleFilters): ArticleFilters {
  return {
    category: f.category,
    mediaTypes: new Set(f.mediaTypes),
    topics: new Set(f.topics),
    sentiments: new Set(f.sentiments),
    storyValueRange: { ...f.storyValueRange },
    dateRange: { start: f.dateRange.start, end: f.dateRange.end },
    sort: f.sort,
  };
}

interface ArticleSavedFiltersContextValue {
  saved: ArticleSavedFilter[];
  saveFilter: (name: string, filters: ArticleFilters) => void;
  removeFilter: (id: number) => void;
}

const ArticleSavedFiltersContext = createContext<ArticleSavedFiltersContextValue | null>(null);

// Session-scoped saved filter presets for the MediaWatch filter sheet — the
// article analogue of SavedFiltersProvider, kept separate since ArticleFilters
// and MentionsFilters are different shapes (see mediawatch-metrics.ts).
export function ArticleSavedFiltersProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<ArticleSavedFilter[]>([]);

  function saveFilter(name: string, filters: ArticleFilters) {
    setSaved((prev) => [
      ...prev,
      { id: prev.reduce((m, s) => Math.max(m, s.id), 0) + 1, name, filters: cloneArticleFilters(filters) },
    ]);
  }
  function removeFilter(id: number) {
    setSaved((prev) => prev.filter((s) => s.id !== id));
  }

  const value = useMemo(() => ({ saved, saveFilter, removeFilter }), [saved]);
  return <ArticleSavedFiltersContext.Provider value={value}>{children}</ArticleSavedFiltersContext.Provider>;
}

export function useArticleSavedFilters() {
  const ctx = useContext(ArticleSavedFiltersContext);
  if (!ctx) throw new Error('useArticleSavedFilters must be used within an ArticleSavedFiltersProvider');
  return ctx;
}
