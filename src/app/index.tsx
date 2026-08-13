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
import { CategoryDropdown } from '@/components/category-dropdown';
import { MentionCard } from '@/components/mention-card';
import {
  DEFAULT_FILTERS,
  MentionsFilters,
  MentionsFiltersSheet,
} from '@/components/mentions-filters-sheet';
import { MmiIcon } from '@/components/mmi-icon';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { socialMentions } from '@/data/sample-data';
import { bucketsForCategory, CATEGORY_TAXONOMY } from '@/data/taxonomy';
import { SocialMention } from '@/data/types';

// Local warm theme, scoped to this screen only — the rest of the app keeps
// the system light/dark theme from constants/theme.ts.
const palette = {
  background: '#F5F4F0',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  chipActiveBg: '#1A1A1A',
  topicBg: '#F0E9DC',
};

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

// Horizontal scroll row that fades its trailing edge when there's more
// content off-screen, so users know the chips/topics are swipeable.
function FadeEdgeRow({
  scrollRef,
  children,
}: {
  scrollRef?: React.RefObject<ScrollView | null>;
  children: React.ReactNode;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const showFade = contentWidth > containerWidth + 1;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        onContentSizeChange={(w) => setContentWidth(w)}>
        {children}
      </ScrollView>
      {showFade && (
        <LinearGradient
          colors={['#F5F4F000', palette.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fadeEdge, { pointerEvents: 'none' }]}
        />
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { isSaved, toggleSave } = useBookmarks();
  const [filters, setFilters] = useState<MentionsFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_TAXONOMY[0].name);

  const authorScrollRef = useRef<ScrollView>(null);
  const authorOffsets = useRef<Record<string, number>>({});
  const listRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const router = useRouter();
  const { accentColor } = useAuth();
  const { hideProgress } = useTabBarVisibility();
  const insets = useSafeAreaInsets();

  const [topBarHeight, setTopBarHeight] = useState(56);
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
  }

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
    return filtered.sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return filters.sortOrder === 'newest' ? diff : -diff;
    });
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
      <StatusBar style="dark" />
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.textSecondary} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <FadeEdgeRow scrollRef={authorScrollRef}>
                {selectedAuthor && (
                  <Pressable
                    onPress={() => setSelectedAuthor(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Clear author filter"
                    style={styles.authorItem}>
                    <View style={styles.clearAvatar}>
                      <Ionicons name="close" size={18} color={palette.textSecondary} />
                    </View>
                    <Text style={styles.authorLabel} numberOfLines={1}>
                      Clear
                    </Text>
                  </Pressable>
                )}
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
            <MmiIcon size={26} color={accentColor} />
            <CategoryDropdown value={selectedCategory} onChange={setSelectedCategory} />
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              hitSlop={8}>
              <Ionicons name="options-outline" size={22} color={palette.text} />
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

        <MentionsFiltersSheet
          visible={filtersOpen}
          initialFilters={filters}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  topBarFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.background,
    zIndex: 2,
  },
  statusBarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: palette.background,
    zIndex: 1,
  },
  chipRow: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
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
    borderColor: palette.chipActiveBg,
  },
  clearAvatar: {
    width: 44,
    height: 44,
    margin: 3,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.topicBg,
  },
  authorLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: palette.text,
    maxWidth: 64,
  },
  authorLabelActive: {
    color: palette.chipActiveBg,
  },
  fadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
  listHeader: {
    marginHorizontal: -Spacing.three,
    paddingBottom: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
  },
});
