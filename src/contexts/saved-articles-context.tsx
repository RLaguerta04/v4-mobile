import { createContext, useContext, useMemo, useState } from 'react';

export interface SavedArticleFolder {
  id: string;
  name: string;
}

interface SavedArticlesContextValue {
  folders: SavedArticleFolder[];
  // url -> folder id, or null for saved-but-unfiled. Absence = not saved.
  folderOfUrl: Record<string, string | null>;
  isArticleSaved: (url: string) => boolean;
  toggleSaveArticle: (url: string) => void;
  moveToFolder: (url: string, folderId: string | null) => void;
  createFolder: (name: string) => void;
}

const SavedArticlesContext = createContext<SavedArticlesContextValue | null>(null);

export function SavedArticlesProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<SavedArticleFolder[]>([]);
  const [folderOfUrl, setFolderOfUrl] = useState<Record<string, string | null>>({});

  function toggleSaveArticle(url: string) {
    setFolderOfUrl((prev) => {
      if (url in prev) {
        const next = { ...prev };
        delete next[url];
        return next;
      }
      // Saving without picking a folder up front — organize into a folder
      // later from the Saved Articles page.
      return { ...prev, [url]: null };
    });
  }

  function moveToFolder(url: string, folderId: string | null) {
    setFolderOfUrl((prev) => ({ ...prev, [url]: folderId }));
  }

  function createFolder(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolders((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: trimmed }]);
  }

  const value = useMemo(
    () => ({
      folders,
      folderOfUrl,
      isArticleSaved: (url: string) => url in folderOfUrl,
      toggleSaveArticle,
      moveToFolder,
      createFolder,
    }),
    [folders, folderOfUrl],
  );

  return <SavedArticlesContext.Provider value={value}>{children}</SavedArticlesContext.Provider>;
}

export function useSavedArticles() {
  const ctx = useContext(SavedArticlesContext);
  if (!ctx) throw new Error('useSavedArticles must be used within a SavedArticlesProvider');
  return ctx;
}
