// MediaWatch "Mentions" feed — the Home-tab content when activeView is
// MediaWatch (the article analogue of the SharedView social feed in
// src/app/index.tsx). Filter bar + article Today's Brief + a FlatList of
// ArticleCards, driven entirely by newsArticles. SharedView's feed is untouched.
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CategoryDropdown } from '@/components/category-dropdown';
import { FeedCoverageBar } from '@/components/feed-coverage-bar';
import { ArticleBriefCard } from '@/components/mediawatch/article-brief-card';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { ArticleFiltersSheet } from '@/components/mediawatch/article-filters-sheet';
import { ViewSwitcher } from '@/components/view-switcher';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useCategoryFilter } from '@/contexts/category-filter-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { newsArticles } from '@/data/mediawatch-articles';
import {
  ArticleFilters,
  defaultArticleFilters,
  filterArticles,
  hasActiveArticleFilters,
} from '@/data/mediawatch-metrics';

const palette = {
  background: '#F5F4F0',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
};

export function MediaWatchMentions() {
  const { accentColor, activeView, selectView } = useAuth();
  const { selectedCategory, setSelectedCategory } = useCategoryFilter();
  const { hideProgress } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();

  const [filters, setFilters] = useState<ArticleFilters>(() => defaultArticleFilters(selectedCategory));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(56);
  const [coverageH, setCoverageH] = useState(72);
  // Height of the list-header content that sits ABOVE the coverage bar (the
  // brief) — drives where the coverage bar rests before it pins.
  const [headerBeforeH, setHeaderBeforeH] = useState(0);

  const listRef = useRef<FlatList>(null);
  const lastScrollY = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down'>('up');
  // Sticky coverage bar: its translateY is computed in JS from the scroll
  // offset and the nav's hide-progress (mirrored latest value in hpRef).
  const coverageTranslate = useRef(new Animated.Value(0)).current;
  const hpRef = useRef(0);

  // Keep the filter sheet's category in sync with the header dropdown.
  const activeFilters = useMemo<ArticleFilters>(
    () => ({ ...filters, category: selectedCategory }),
    [filters, selectedCategory],
  );

  const articles = useMemo(() => filterArticles(newsArticles, activeFilters), [activeFilters]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  useEffect(() => {
    // @ts-expect-error tabPress is only available when the navigator type is 'tab'
    return navigation.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      handleRefresh();
    });
  }, [navigation, handleRefresh]);

  useEffect(() => {
    return navigation.addListener('blur', () => {
      Animated.timing(hideProgress, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      scrollDirectionRef.current = 'up';
    });
  }, [navigation, hideProgress]);

  function animateBars(toValue: 0 | 1) {
    Animated.timing(hideProgress, {
      toValue,
      duration: toValue === 1 ? 220 : 260,
      easing: toValue === 1 ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  // Position the coverage bar: it rides just below the brief (naturalTop) until
  // that scrolls off, then clamps to just under the nav — which itself slides to
  // the top edge as it hides (pinnedTop). Math.max keeps it from sliding under
  // the nav on the way up.
  const recomputeCoverage = useCallback(
    (y: number) => {
      const naturalTop = topBarHeight + headerBeforeH - y;
      const pinnedTop = topBarHeight - hpRef.current * (topBarHeight - insets.top);
      coverageTranslate.setValue(Math.max(pinnedTop, naturalTop));
    },
    [topBarHeight, headerBeforeH, insets.top, coverageTranslate],
  );

  useEffect(() => {
    recomputeCoverage(lastScrollY.current);
    const id = hideProgress.addListener(({ value }) => {
      hpRef.current = value;
      recomputeCoverage(lastScrollY.current);
    });
    return () => hideProgress.removeListener(id);
  }, [recomputeCoverage, hideProgress]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = event.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (y <= 20) {
      if (scrollDirectionRef.current !== 'up') {
        scrollDirectionRef.current = 'up';
        animateBars(0);
      }
    } else if (Math.abs(diff) > 4) {
      const direction = diff > 0 ? 'down' : 'up';
      if (direction !== scrollDirectionRef.current) {
        scrollDirectionRef.current = direction;
        animateBars(direction === 'down' ? 1 : 0);
      }
    }
    lastScrollY.current = y;
    recomputeCoverage(y);
  }

  const hasFilters = hasActiveArticleFilters(activeFilters);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.statusBarBackdrop, { height: insets.top }]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={articles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: topBarHeight }]}
          onScroll={(e) => {
            handleScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.textSecondary} />
          }
          ListHeaderComponent={
            <>
              <View onLayout={(e: LayoutChangeEvent) => setHeaderBeforeH(e.nativeEvent.layout.height)}>
                <View style={styles.briefWrap}>
                  <ArticleBriefCard articles={newsArticles} />
                </View>
              </View>
              {/* Reserves the in-flow space the (absolutely-positioned, sticky)
                  coverage bar overlays, so it sits below the brief and the
                  articles don't slide under it. */}
              <View style={{ height: coverageH }} />
            </>
          }
          renderItem={({ item }) => <ArticleCard article={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No articles match these filters.</Text>}
        />

        <Animated.View
          onLayout={(e: LayoutChangeEvent) => setTopBarHeight(e.nativeEvent.layout.height)}
          style={[
            styles.topBar,
            { paddingTop: insets.top + Spacing.two },
            {
              opacity: hideProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateY: hideProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -topBarHeight] }) },
              ],
            },
          ]}>
          <View style={styles.brandRow}>
            <ViewSwitcher variant="logo" value={activeView ?? 'MediaWatch'} onChange={selectView} />
          </View>
          <CategoryDropdown value={selectedCategory} onChange={setSelectedCategory} />
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={hasFilters ? 'Open filters. Filters active' : 'Open filters'}
              hitSlop={8}>
              <Ionicons name="options-outline" size={22} color={palette.text} />
              {hasFilters && <View style={[styles.filterDot, { backgroundColor: accentColor }]} />}
            </Pressable>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              hitSlop={8}>
              <Ionicons name="person-circle-outline" size={26} color={palette.text} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Sticky coverage bar — scrolls below the brief card, then pins to the
            top once the brief scrolls past (position driven by recomputeCoverage). */}
        <Animated.View
          onLayout={(e: LayoutChangeEvent) => setCoverageH(e.nativeEvent.layout.height)}
          style={[styles.coverageBar, { transform: [{ translateY: coverageTranslate }] }]}>
          <FeedCoverageBar items={articles} noun="article" dateRange={activeFilters.dateRange} />
        </Animated.View>

        <ArticleFiltersSheet
          visible={filtersOpen}
          initialFilters={activeFilters}
          onApply={(next) => {
            setFilters(next);
            setSelectedCategory(next.category);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />

        <BackToTop visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  list: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    backgroundColor: palette.background,
    zIndex: 3,
  },
  coverageBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.background,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    zIndex: 2,
  },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerActions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.three },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: palette.background,
  },
  statusBarBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: palette.background, zIndex: 1 },
  briefWrap: { marginTop: Spacing.two, marginBottom: Spacing.three },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  separator: { height: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7DDCC', marginBottom: Spacing.three },
  emptyText: { textAlign: 'center', color: palette.textSecondary, paddingTop: Spacing.six },
});
