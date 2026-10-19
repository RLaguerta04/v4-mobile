import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme as useRNColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { AccentOnDark, Colors, SemanticColors, Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The user's preference: follow the OS, or force one scheme. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** The scheme actually in effect right now. */
  scheme: ColorScheme;
  isDark: boolean;
  /** The resolved color token set for `scheme`. */
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// NOTE: preference is in-memory only, matching the rest of this prototype
// (auth/view state in auth-context also resets on reload). To persist the
// choice across launches, add @react-native-async-storage/async-storage and
// hydrate `mode` from it here — the rest of the system needs no changes.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  // Live OS scheme — only consulted when the user is following the system.
  const systemScheme = useRNColorScheme();

  // Anything that isn't an explicit 'dark' (null / undefined / 'unspecified')
  // falls back to light.
  const scheme: ColorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const theme = Colors[scheme];

  // Keep native surfaces that live outside React in sync: the imperative
  // color-scheme override (status bar, keyboard, system controls) and the
  // root view background (prevents a light flash behind/around the app).
  useEffect(() => {
    try {
      // 'unspecified' = clear the override and follow the OS again. This
      // RN/Android build's native setColorScheme is non-null, so passing
      // `null` crashes ("Parameter specified as non-null is null"); the typed
      // ColorSchemeName here is 'light' | 'dark' | 'unspecified', not null.
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    } catch {
      // Unavailable on some targets (e.g. web) — the in-React theme still
      // applies, so this is non-fatal.
    }
  }, [mode]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, scheme, isDark: scheme === 'dark', theme }),
    [mode, scheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within a ThemeProvider');
  return ctx;
}

/** The resolved color tokens for the active scheme. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** Mode preference + the live scheme, for toggles and scheme-aware logic. */
export function useThemeMode() {
  const { mode, setMode, scheme, isDark } = useThemeContext();
  return { mode, setMode, scheme, isDark };
}

/** The current scheme's semantic accents (positive/negative/warning/info). */
export function useSemanticColors() {
  return SemanticColors[useThemeContext().scheme];
}

/**
 * The active view's brand accent, swapped for its legible on-dark variant in
 * dark mode. Use in place of `useAuth().accentColor` wherever the accent is
 * drawn as small text/icons so contrast stays >= AA.
 */
export function useAccentColor(): string {
  const { accentColor } = useAuth();
  const { isDark } = useThemeContext();
  return isDark ? (AccentOnDark[accentColor] ?? accentColor) : accentColor;
}
