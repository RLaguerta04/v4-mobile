import { useMemo } from 'react';

import { Theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Bridges the static-StyleSheet world to theming. Instead of a module-level
 *   const styles = StyleSheet.create({ card: { backgroundColor: '#FFF' } })
 * (evaluated once, can't see the theme), write a factory that takes the theme
 *   const makeStyles = (t: Theme) => StyleSheet.create({ card: { backgroundColor: t.card } })
 * and call it inside the component:
 *   const styles = useThemedStyles(makeStyles)
 *
 * The result is memoized on the resolved theme, so styles are rebuilt only
 * when the scheme actually flips. Define `makeStyles` at module scope so its
 * identity is stable across renders.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
