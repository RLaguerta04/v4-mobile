import { createContext, useContext, useMemo, useState } from 'react';

export interface SavedArticleFolder {
  id: string;
  name: string;
}

// Stable per-folder accent, cycled by creation order (index in `folders`).
// Shared by the Saved Articles screen and the Save-to-folder picker so a
// folder wears the same color in both places.
export const FOLDER_COLORS = [
  '#6B4DE8',
  '#16A34A',
  '#E94F37',
  '#2563EB',
  '#D97706',
  '#0891B2',
  '#DB2777',
  '#7C3AED',
];

interface SavedArticlesContextValue {
  folders: SavedArticleFolder[];
  // url -> folder id, or null for saved-but-unfiled. Absence = not saved.
  folderOfUrl: Record<string, string | null>;
  isArticleSaved: (url: string) => boolean;
  toggleSaveArticle: (url: string) => void;
  moveToFolder: (url: string, folderId: string | null) => void;
  // Returns the created folder (so a caller can immediately file into it), or
  // null when the name is blank.
  createFolder: (name: string) => SavedArticleFolder | null;
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

  function createFolder(name: string): SavedArticleFolder | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const folder: SavedArticleFolder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
    };
    setFolders((prev) => [...prev, folder]);
    return folder;
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
