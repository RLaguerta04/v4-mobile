/**
 * Light/dark theming entry point. The resolved token set and mode controls
 * live in the ThemeProvider (contexts/theme-context); this file re-exports the
 * hooks so existing `@/hooks/use-theme` importers keep working unchanged.
 *
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */
export {
  useTheme,
  useThemeMode,
  useSemanticColors,
  useAccentColor,
} from '@/contexts/theme-context';
