import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '@/components/login-screen';
import { ViewSelectionScreen } from '@/components/view-selection-screen';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { BookmarksProvider } from '@/contexts/bookmarks-context';
import { CategoryFilterProvider } from '@/contexts/category-filter-context';
import { SavedArticlesProvider } from '@/contexts/saved-articles-context';
import { SavedFiltersProvider } from '@/contexts/saved-filters-context';
import { TabBarVisibilityProvider } from '@/contexts/tab-bar-visibility-context';
import { TrackerProvider } from '@/contexts/tracker-context';

SplashScreen.preventAutoHideAsync();

// Split out so useAuth() can be called inside AuthProvider's own subtree.
function RootContent() {
  const { isAuthenticated, activeView } = useAuth();

  if (!isAuthenticated) return <LoginScreen />;
  if (!activeView) return <ViewSelectionScreen />;

  return (
    <TabBarVisibilityProvider>
      <CategoryFilterProvider>
        <BookmarksProvider>
          <SavedArticlesProvider>
            <TrackerProvider>
              <SavedFiltersProvider>
                <AppTabs />
              </SavedFiltersProvider>
            </TrackerProvider>
          </SavedArticlesProvider>
        </BookmarksProvider>
      </CategoryFilterProvider>
    </TabBarVisibilityProvider>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  // Keep the native splash screen up (already prevented from auto-hiding
  // above) until the real Media Meter fonts are ready, so there's no flash
  // of system-font text before they swap in.
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AuthProvider>
          <RootContent />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
