import { createContext, useContext, useState } from 'react';

import { CATEGORY_TAXONOMY } from '@/data/taxonomy';

// The Home feed's active monitoring category. Lifted out of HomeScreen's local
// state so more than one surface can read/write it: the Home header's
// CategoryDropdown and the Categories screen (reached from the More tab) both
// drive the same value, so tapping a category tile there filters Home to it —
// one source of truth, the same way the Filters sheet shares its `topics` set.
interface CategoryFilterContextValue {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const CategoryFilterContext = createContext<CategoryFilterContextValue | null>(null);

export function CategoryFilterProvider({ children }: { children: React.ReactNode }) {
  // Always resolves to a real category — defaults to the first in taxonomy
  // order, matching HomeScreen's previous local default. No "All" state.
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_TAXONOMY[0].name);

  return (
    <CategoryFilterContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      {children}
    </CategoryFilterContext.Provider>
  );
}

export function useCategoryFilter() {
  const ctx = useContext(CategoryFilterContext);
  if (!ctx) {
    throw new Error('useCategoryFilter must be used within a CategoryFilterProvider');
  }
  return ctx;
}
