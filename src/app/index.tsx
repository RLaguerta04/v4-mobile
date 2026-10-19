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

import { AuthorAvatar } from '@/components/author-avatar';
import { FeedCoverageBar } from '@/components/feed-coverage-bar';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CategoryDropdown } from '@/components/category-dropdown';
import { FadeEdgeRow } from '@/components/fade-edge-row';
import { MediaWatchMentions } from '@/components/mediawatch/mentions-screen';
import { MentionCard } from '@/components/mention-card';
import {
  ALL_PLATFORMS,
  DEFAULT_FILTERS,
  last7Days,
  MentionsFilters,
  MentionsFiltersSheet,
  sortMentions,
} from '@/components/mentions-filters-sheet';
import { TodaysBriefCard } from '@/components/todays-brief-card';
import { ViewSwitcher } from '@/components/view-switcher';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useCategoryFilter } from '@/contexts/category-filter-context';
import { isArticleView } from '@/data/article-workspace';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { socialMentions } from '@/data/sample-data';
import { bucketsForCategory } from '@/data/taxonomy';
import { SocialMention } from '@/data/types';

// One avatar per author who appears in the feed, in first-seen order — every
// avatar in this row corresponds to a card actually visible below it.
function uniqueAuthors(mentions: SocialMention[]) {
  const seen = new Set<string>();
  const result: { handle: string; platform: SocialMention['platform'] }[] = [];
  for (const mention of mentions) {
    if (seen.has(mention.handle)) continue;
    seen.add(mention.handle);
    result.push({ handle: mention.handle, platform: mention.platform });
  }
  return result;
}

// Route dispatcher: the article workspaces (MediaWatch news, AdWatch ads) render
// the shared article Mentions feed; every other view (SharedView) keeps the
// social feed below, byte-for-byte unchanged.
export default function HomeRoute() {
  const { activeView } = useAuth();
  return isArticleView(activeView) ? <MediaWatchMentions /> : <SharedViewHome />;
}

function SharedViewHome() {
  const { isSaved, toggleSave } = useBookmarks();
  // Default the Home feed to the last 7 days (see FeedCoverageBar / filters).
  const [filters, setFilters] = useState<MentionsFilters>(() => ({
    ...DEFAULT_FILTERS,
    dateRange: last7Days(),
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Shared with the Categories screen (reached from More) and the header
  // dropdown below — selecting a category anywhere drives this one feed filter.
  const { selectedCategory, setSelectedCategory } = useCategoryFilter();

  const authorScrollRef = useRef<ScrollView>(null);
  const authorOffsets = useRef<Record<string, number>>({});
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { activeView, selectView } = useAuth();
  const accentColor = useAccentColor();
  const { hideProgress } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();

  const [topBarHeight, setTopBarHeight] = useState(56);
  const [coverageH, setCoverageH] = useState(72);
  const [headerBeforeH, setHeaderBeforeH] = useState(0);
  const coverageTranslate = useRef(new Animated.Value(0)).current;
  const hpRef = useRef(0);
  const lastScrollY = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down'>('up');

  const authors = useMemo(() => uniqueAuthors(socialMentions), []);

  // Sample data only — there's no backend to actually fetch new posts from,
  // so "refresh" just shows the real pull-to-refresh motion and settles
  // back on the same feed, rather than fabricating fake new content.
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  // expo-router/ui's tab triggers emit a standard React Navigation
  // 'tabPress' event on every press, even when that tab is already active —
  // tapping Home while already on Home scrolls to top and refreshes, same
  // as Twitter/Instagram's "tap the active tab" behavior.
  useEffect(() => {
    // @ts-expect-error tabPress is only available when the navigator type is 'tab'
    return navigation.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      handleRefresh();
    });
  }, [navigation, handleRefresh]);

  // Guarantees the bottom tab bar isn't left hidden when switching away from
  // Home after scrolling down here — it should only ever hide while Home's
  // own feed is actively being scrolled, not "stuck" on other tabs.
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

  // Sticky coverage bar: it scrolls with the feed just below the brief card,
  // then pins once the brief has scrolled past — just under the nav row, or at
  // the status-bar edge once the nav itself hides. Driven in JS from the scroll
  // offset and the nav's hide-progress so it never overlaps the nav.
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

  // Hides the top/bottom bars on a sustained downward scroll, shows them on
  // any upward scroll or whenever the feed is near its very top — ignores
  // small jitter and the elastic top-of-list bounce so they don't flicker.
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

  // Anything diverging from the defaults counts as an active filter — drives the
  // indicator dot. The date window is excluded: the feed defaults to a 7-day
  // range, so it's a standing scope rather than an ad-hoc filter.
  const hasActiveFilters =
    filters.topics.size > 0 ||
    filters.platforms.size !== ALL_PLATFORMS.length ||
    filters.sortOrder !== 'newest';

  const filteredMentions = useMemo(() => {
    const { start, end } = filters.dateRange;
    const categoryBuckets = new Set(bucketsForCategory(selectedCategory));
    const filtered = socialMentions.filter((mention) => {
      if (selectedAuthor && mention.handle !== selectedAuthor) return false;
      if (!mention.entities.some((e) => categoryBuckets.has(e))) return false;
      if (filters.topics.size > 0 && !mention.entities.some((e) => filters.topics.has(e))) {
        return false;
      }
      if (!filters.platforms.has(mention.platform)) return false;
      if (start || end) {
        const mentionDate = new Date(mention.date);
        if (start && mentionDate < start) return false;
        if (end && mentionDate > end) return false;
      }
      return true;
    });
    return sortMentions(filtered, filters.sortOrder);
  }, [filters, selectedAuthor, selectedCategory]);

  function toggleAuthor(handle: string) {
    setSelectedAuthor((prev) => (prev === handle ? null : handle));
    if (authorOffsets.current[handle] !== undefined) {
      authorScrollRef.current?.scrollTo({
        x: Math.max(authorOffsets.current[handle] - Spacing.three, 0),
        animated: true,
      });
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style={theme.statusBarStyle} />
      {/* Always-visible backdrop behind the real status bar — the floating
          header used to be the only thing covering this strip, so hiding it
          on scroll left the status bar icons over whatever content had
          scrolled underneath instead of a consistent, readable background. */}
      <View style={[styles.statusBarBackdrop, { height: insets.top }]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={filteredMentions}
          keyExtractor={(item) => item.url}
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
            <View style={styles.listHeader}>
              <View onLayout={(e: LayoutChangeEvent) => setHeaderBeforeH(e.nativeEvent.layout.height)}>
              <View style={styles.rowWrap}>
                <FadeEdgeRow
                  scrollRef={authorScrollRef}
                  contentContainerStyle={selectedAuthor ? styles.rowInset : undefined}>
                  {authors.map(({ handle, platform }) => {
                    const active = selectedAuthor === handle;
                    return (
                      <Pressable
                        key={handle}
                        onLayout={(e) => {
                          authorOffsets.current[handle] = e.nativeEvent.layout.x;
                        }}
                        onPress={() => toggleAuthor(handle)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={styles.authorItem}>
                        <View style={[styles.avatarRing, active && styles.avatarRingActive]}>
                          <AuthorAvatar handle={handle} platform={platform} size={44} />
                        </View>
                        <Text
                          style={[styles.authorLabel, active && styles.authorLabelActive]}
                          numberOfLines={1}>
                          {handle}
                        </Text>
                      </Pressable>
                    );
                  })}
                </FadeEdgeRow>
                {/* Pinned "Clear" — outside the scroll so it stays on the left;
                    avatars scroll under it and fade out behind the gradient. */}
                {selectedAuthor && (
                  <View style={[styles.clearPinned, { pointerEvents: 'box-none' }]}>
                    <View style={styles.clearBlock}>
                      <Pressable
                        onPress={() => setSelectedAuthor(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Clear author filter"
                        style={styles.authorItem}>
                        <View style={styles.clearAvatar}>
                          <Ionicons name="close" size={18} color={theme.textSecondary} />
                        </View>
                        <Text style={styles.authorLabel} numberOfLines={1}>
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
              {/* Today's Brief is a fixed daily summary of the FULL dataset, so
                  it's hidden while an influencer is selected — the feed is scoped
                  to one author then, and the global brief would be misleading.
                  When shown, its content stays global: it does NOT react to the
                  category dropdown, filter sheet, or sort order. No `category` is
                  passed so "View full brief" opens the same global brief. */}
              {!selectedAuthor && (
                <View style={styles.briefWrap}>
                  <TodaysBriefCard mentions={socialMentions} />
                </View>
              )}
              </View>
              {/* Reserves the in-flow space the (absolutely-positioned, sticky)
                  coverage bar overlays, so it sits below the brief and the posts
                  don't slide under it. */}
              <View style={{ height: coverageH }} />
            </View>
          }
          renderItem={({ item }) => (
            <MentionCard mention={item} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No mentions match these filters.</Text>}
        />

        <Animated.View
          onLayout={(e: LayoutChangeEvent) => setTopBarHeight(e.nativeEvent.layout.height)}
          style={[
            styles.topBar,
            styles.topBarFloating,
            { paddingTop: insets.top + Spacing.two },
            {
              opacity: hideProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                {
                  translateY: hideProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -topBarHeight],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.brandRow}>
            <ViewSwitcher variant="logo" value={activeView ?? 'SharedView'} onChange={selectView} />
          </View>
          <CategoryDropdown value={selectedCategory} onChange={setSelectedCategory} />
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={hasActiveFilters ? 'Open filters. Filters active' : 'Open filters'}
              hitSlop={8}>
              <Ionicons name="options-outline" size={22} color={theme.text} />
              {hasActiveFilters && <View style={[styles.filterDot, { backgroundColor: accentColor }]} />}
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
          <FeedCoverageBar items={filteredMentions} noun="post" dateRange={filters.dateRange} />
        </Animated.View>

        <MentionsFiltersSheet
          visible={filtersOpen}
          initialFilters={filters}
          showMetricSort
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />

        <BackToTop
          visible={showTop}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  safeArea: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
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
  topBarFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: t.background,
    zIndex: 3,
  },
  // Sticky coverage strip — translateY is driven in JS (recomputeCoverage).
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
  statusBarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: t.background,
    zIndex: 1,
  },
  rowWrap: { position: 'relative' },
  // Reserve the pinned Clear's footprint (16 pad + 64 item + 16 gap) so the
  // first avatar starts to its right when an author is selected.
  rowInset: { paddingLeft: 96 },
  clearPinned: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'stretch', zIndex: 3 },
  clearBlock: { backgroundColor: t.background, paddingLeft: Spacing.three },
  clearFade: { width: Spacing.three },
  authorItem: {
    width: 64,
    flexShrink: 0,
    alignItems: 'center',
    gap: 4,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarRingActive: {
    borderColor: t.text,
  },
  clearAvatar: {
    width: 44,
    height: 44,
    margin: 3,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.topicBg,
  },
  authorLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: t.text,
    maxWidth: 64,
  },
  authorLabelActive: {
    color: t.text,
  },
  listHeader: {
    marginHorizontal: -Spacing.three,
    paddingBottom: Spacing.two,
  },
  // listHeader stretches edge-to-edge for the avatar row's fade; the brief
  // card restores the list's horizontal inset.
  briefWrap: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    color: t.textSecondary,
    paddingTop: Spacing.six,
  },
});
