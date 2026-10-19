// MediaWatch "Mentions" feed — the Home-tab content when activeView is
// MediaWatch (the article analogue of the SharedView social feed in
// src/app/index.tsx). Filter bar + article Today's Brief + a FlatList of
// ArticleCards, driven entirely by newsArticles. SharedView's feed is untouched.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CategoryDropdown } from '@/components/category-dropdown';
import { FadeEdgeRow } from '@/components/fade-edge-row';
import { FeedCoverageBar } from '@/components/feed-coverage-bar';
import { ArticleBriefCard } from '@/components/mediawatch/article-brief-card';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { ArticleFiltersSheet } from '@/components/mediawatch/article-filters-sheet';
import { ViewSwitcher } from '@/components/view-switcher';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useCategoryFilter } from '@/contexts/category-filter-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useArticleWorkspace } from '@/data/article-workspace';
import {
  ArticleFilters,
  buildPublishers,
  defaultArticleFilters,
  filterArticles,
  hasActiveArticleFilters,
} from '@/data/mediawatch-metrics';

// Publishers have no photo avatar (unlike SharedView's authors), so the row
// uses a brand-colored initial badge — the same scheme as the Publishers page
// and the dashboard's Top Publisher KPI.
const AVATAR_COLORS = ['#E94F37', '#2563EB', '#7C3AED', '#0D9488', '#D97706', '#DB2777', '#16A34A', '#4F46E5'];
function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initialOf(name: string): string {
  return name.replace(/^[@#]/, '').charAt(0).toUpperCase() || '?';
}

export function MediaWatchMentions() {
  const { activeView, selectView } = useAuth();
  const accentColor = useAccentColor();
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const ws = useArticleWorkspace();
  const { selectedCategory, setSelectedCategory } = useCategoryFilter();
  const { hideProgress } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();

  const [filters, setFilters] = useState<ArticleFilters>(() => defaultArticleFilters(selectedCategory));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Quick publisher filter driven by the avatar row above the brief (MediaWatch
  // only) — kept separate from the filter sheet, mirroring SharedView's author
  // row (src/app/index.tsx `selectedAuthor`).
  const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);
  const [topBarHeight, setTopBarHeight] = useState(56);
  const [coverageH, setCoverageH] = useState(72);
  // Height of the list-header content that sits ABOVE the coverage bar (the
  // publisher row + brief) — drives where the coverage bar rests before it pins.
  const [headerBeforeH, setHeaderBeforeH] = useState(0);

  const listRef = useRef<FlatList>(null);
  const publisherScrollRef = useRef<ScrollView>(null);
  const publisherOffsets = useRef<Record<string, number>>({});
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

  // The category/filter-scoped feed (before the publisher quick-filter) — drives
  // both the publisher row (top publishers IN this view) and, once the publisher
  // filter is applied, the visible feed.
  const scoped = useMemo(() => filterArticles(ws.articles, activeFilters), [ws.articles, activeFilters]);

  // Top publishers present in the current view, ranked by article count.
  // AdWatch's lean Mentions keeps the SharedView-style row off (web parity).
  const publishers = useMemo(
    () => (ws.adMode ? [] : buildPublishers(scoped).sort((a, b) => b.count - a.count)),
    [ws.adMode, scoped],
  );

  const articles = useMemo(
    () => (selectedPublisher ? scoped.filter((a) => a.outlet === selectedPublisher) : scoped),
    [scoped, selectedPublisher],
  );

  // Drop a stale publisher selection when it falls out of the scoped view (e.g.
  // after a category change), so the feed never ends up empty with no matching chip.
  useEffect(() => {
    if (selectedPublisher && !publishers.some((p) => p.name === selectedPublisher)) {
      setSelectedPublisher(null);
    }
  }, [publishers, selectedPublisher]);

  function togglePublisher(name: string) {
    setSelectedPublisher((prev) => (prev === name ? null : name));
    const x = publisherOffsets.current[name];
    if (x !== undefined) {
      publisherScrollRef.current?.scrollTo({ x: Math.max(x - Spacing.three, 0), animated: true });
    }
  }

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
      <StatusBar style={theme.statusBarStyle} />
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.textSecondary} />
          }
          ListHeaderComponent={
            // Breaks edge-to-edge (negative inset) so the publisher row can fade
            // off the screen edge; the brief restores the list inset below.
            <View style={styles.listHeader}>
              <View onLayout={(e: LayoutChangeEvent) => setHeaderBeforeH(e.nativeEvent.layout.height)}>
                {/* Top publishers in the current view — the article analogue of
                    SharedView's author row, above Today's Brief. */}
                {publishers.length > 0 && (
                  <View style={styles.rowWrap}>
                    <FadeEdgeRow
                      scrollRef={publisherScrollRef}
                      contentContainerStyle={selectedPublisher ? styles.rowInset : undefined}>
                      {publishers.map((p) => {
                        const active = selectedPublisher === p.name;
                        return (
                          <Pressable
                            key={p.name}
                            onLayout={(e) => {
                              publisherOffsets.current[p.name] = e.nativeEvent.layout.x;
                            }}
                            onPress={() => togglePublisher(p.name)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            style={styles.publisherItem}>
                            <View style={[styles.avatarRing, active && { borderColor: accentColor }]}>
                              <View style={[styles.publisherAvatar, { backgroundColor: hashColor(p.name) }]}>
                                <Text style={styles.publisherAvatarText}>{initialOf(p.name)}</Text>
                              </View>
                            </View>
                            <Text
                              style={[styles.publisherLabel, active && { color: accentColor }]}
                              numberOfLines={1}>
                              {p.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </FadeEdgeRow>
                    {/* Pinned "Clear" — lives outside the scroll so it stays on the
                        left; avatars scroll under it and fade out behind the gradient. */}
                    {selectedPublisher && (
                      <View style={[styles.clearPinned, { pointerEvents: 'box-none' }]}>
                        <View style={styles.clearBlock}>
                          <Pressable
                            onPress={() => setSelectedPublisher(null)}
                            accessibilityRole="button"
                            accessibilityLabel="Clear publisher filter"
                            style={styles.publisherItem}>
                            <View style={styles.clearAvatar}>
                              <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </View>
                            <Text style={styles.publisherLabel} numberOfLines={1}>
                              Clear
                            </Text>
                          </Pressable>
                        </View>
                        <LinearGradient
                          colors={[theme.background, `${theme.background}00`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.clearFade, { pointerEvents: 'none' }]}
                        />
                      </View>
                    )}
                  </View>
                )}
                {/* Hidden while a publisher is selected — the feed is scoped to
                    one outlet then, so the global daily brief would be misleading. */}
                {!selectedPublisher && (
                  <View style={styles.briefWrap}>
                    <ArticleBriefCard articles={ws.articles} trending={ws.trending} adMode={ws.adMode} />
                  </View>
                )}
              </View>
              {/* Reserves the in-flow space the (absolutely-positioned, sticky)
                  coverage bar overlays, so it sits below the brief and the
                  articles don't slide under it. */}
              <View style={{ height: coverageH }} />
              {/* Breathing room below the bar before the first card — SharedView
                  parity (its listHeader wrapper adds this same gap). */}
              <View style={{ height: Spacing.two }} />
            </View>
          }
          renderItem={({ item }) => <ArticleCard article={item} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No {ws.nouns} match these filters.</Text>}
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
              <Ionicons name="options-outline" size={22} color={theme.text} />
              {hasFilters && <View style={[styles.filterDot, { backgroundColor: accentColor }]} />}
            </Pressable>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              hitSlop={8}>
              <Ionicons name="person-circle-outline" size={26} color={theme.text} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Sticky coverage bar — scrolls below the brief card, then pins to the
            top once the brief scrolls past (position driven by recomputeCoverage). */}
        <Animated.View
          onLayout={(e: LayoutChangeEvent) => setCoverageH(e.nativeEvent.layout.height)}
          style={[styles.coverageBar, { transform: [{ translateY: coverageTranslate }] }]}>
          <FeedCoverageBar items={articles} noun={ws.noun} dateRange={activeFilters.dateRange} />
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

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
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
    backgroundColor: t.background,
    zIndex: 3,
  },
  coverageBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: t.background,
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
    borderColor: t.background,
  },
  statusBarBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: t.background, zIndex: 1 },
  // Stretches edge-to-edge so the publisher row's fade reaches the screen edge;
  // the brief restores the list's horizontal inset.
  listHeader: { marginHorizontal: -Spacing.three },
  briefWrap: { marginHorizontal: Spacing.three, marginTop: Spacing.two, marginBottom: Spacing.two },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  emptyText: { textAlign: 'center', color: t.textSecondary, paddingTop: Spacing.six },

  // Top-publishers row (above the brief) — mirrors SharedView's author row.
  rowWrap: { position: 'relative' },
  // Reserve the pinned Clear's footprint (16 pad + 64 item + 16 gap) so the
  // first avatar starts to its right when a publisher is selected.
  rowInset: { paddingLeft: 96 },
  clearPinned: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'stretch', zIndex: 3 },
  clearBlock: { backgroundColor: t.background, paddingLeft: Spacing.three },
  clearFade: { width: Spacing.three },
  publisherItem: { width: 64, flexShrink: 0, alignItems: 'center', gap: 4 },
  avatarRing: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  publisherAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  publisherAvatarText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  clearAvatar: {
    width: 44,
    height: 44,
    margin: 3,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.topicBg,
  },
  publisherLabel: { fontSize: 10.5, fontWeight: '600', color: t.text, maxWidth: 64 },
});
