import { createContext, useContext, useMemo, useState } from 'react';

interface BookmarksContextValue {
  savedUrls: Set<string>;
  isSaved: (url: string) => boolean;
  toggleSave: (url: string) => void;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

  function toggleSave(url: string) {
    setSavedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  const value = useMemo(
    () => ({ savedUrls, isSaved: (url: string) => savedUrls.has(url), toggleSave }),
    [savedUrls],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarksProvider');
  return ctx;
}
