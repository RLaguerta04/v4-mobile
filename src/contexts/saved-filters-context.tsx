import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import type { MentionsFilters } from '@/components/mentions-filters-sheet';

export interface SavedFilter {
  id: number;
  name: string;
  filters: MentionsFilters;
}

// Deep-clone a filter config so a saved preset stays independent of later edits
// to the sheet's pending state (the Sets and date range are otherwise shared
// references).
export function cloneFilters(f: MentionsFilters): MentionsFilters {
  return {
    sortOrder: f.sortOrder,
    platforms: new Set(f.platforms),
    topics: new Set(f.topics),
    dateRange: { start: f.dateRange.start, end: f.dateRange.end },
    countryEnabled: f.countryEnabled,
  };
}

interface SavedFiltersContextValue {
  saved: SavedFilter[];
  saveFilter: (name: string, filters: MentionsFilters) => void;
  removeFilter: (id: number) => void;
}

const SavedFiltersContext = createContext<SavedFiltersContextValue | null>(null);

// Session-scoped saved filter presets, shared by the Home and Dashboard filter
// sheets. In-memory like the app's other saved state (bookmarks, tracker).
export function SavedFiltersProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedFilter[]>([]);

  function saveFilter(name: string, filters: MentionsFilters) {
    setSaved((prev) => [
      ...prev,
      { id: prev.reduce((m, s) => Math.max(m, s.id), 0) + 1, name, filters: cloneFilters(filters) },
    ]);
  }
  function removeFilter(id: number) {
    setSaved((prev) => prev.filter((s) => s.id !== id));
  }

  const value = useMemo(() => ({ saved, saveFilter, removeFilter }), [saved]);
  return <SavedFiltersContext.Provider value={value}>{children}</SavedFiltersContext.Provider>;
}

export function useSavedFilters() {
  const ctx = useContext(SavedFiltersContext);
  if (!ctx) throw new Error('useSavedFilters must be used within a SavedFiltersProvider');
  return ctx;
}
