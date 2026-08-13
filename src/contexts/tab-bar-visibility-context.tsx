import { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

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
