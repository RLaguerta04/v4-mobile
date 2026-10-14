import { useNavigation } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// One shared Animated.Value (0 = shown, 1 = hidden) so the Home screen's top
// bar and the globally-mounted bottom tab bar — two different components,
// with no convenient common parent to lift state into — animate in sync off
// the same scroll gesture instead of drifting out of step.
interface TabBarVisibilityContextValue {
  hideProgress: Animated.Value;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const hideProgress = useRef(new Animated.Value(0)).current;
  return (
    <TabBarVisibilityContext.Provider value={{ hideProgress }}>{children}</TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error('useTabBarVisibility must be used within a TabBarVisibilityProvider');
  }
  return ctx;
}

// Drives `hideProgress` from a scroll gesture — hide the header + bottom bar on
// a sustained scroll down, show them on any scroll up or near the top. Mirrors
// the Home feed's original handleScroll so every screen hides in the same way.
// Returns the shared `hideProgress` (for a CollapsibleHeader to animate off) and
// an `onScroll` handler to attach to a FlatList/ScrollView. Bars reset to shown
// when the screen loses focus, so switching tabs never lands on a hidden bar.
export function useHideOnScroll() {
  const { hideProgress } = useTabBarVisibility();
  const navigation = useNavigation();
  const lastY = useRef(0);
  const dir = useRef<'up' | 'down'>('up');

  const animateBars = useCallback(
    (to: 0 | 1) => {
      Animated.timing(hideProgress, {
        toValue: to,
        duration: to === 1 ? 220 : 260,
        easing: to === 1 ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [hideProgress],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const diff = y - lastY.current;
      if (y <= 20) {
        if (dir.current !== 'up') {
          dir.current = 'up';
          animateBars(0);
        }
      } else if (Math.abs(diff) > 4) {
        const d: 'up' | 'down' = diff > 0 ? 'down' : 'up';
        if (d !== dir.current) {
          dir.current = d;
          animateBars(d === 'down' ? 1 : 0);
        }
      }
      lastY.current = y;
    },
    [animateBars],
  );

  useEffect(
    () =>
      navigation.addListener('blur', () => {
        animateBars(0);
        dir.current = 'up';
      }),
    [navigation, animateBars],
  );

  return { hideProgress, onScroll };
}
