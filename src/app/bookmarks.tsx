import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PLATFORM_ICON } from '@/components/author-avatar';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { PageHeading } from '@/components/page-heading';
import { SavedUrlCard } from '@/components/saved-url-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { SocialPlatform } from '@/data/types';
import { platformLabel } from '@/utils/influencers';
import { resolveSavedUrls, SavedItem } from '@/utils/saved-resolve';

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  chipBg: '#EDE6D8',
};

export default function BookmarksScreen() {
  const { savedUrls } = useBookmarks();
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const [headerH, setHeaderH] = useState(120);

  // Most-recently-bookmarked first (a Set preserves insertion order). Resolved
  // against both datasets so MediaWatch articles and SharedView posts both show.
  const bookmarked = useMemo<SavedItem[]>(
    () => resolveSavedUrls([...savedUrls].reverse()),
    [savedUrls],
  );

  // Platform chips — only the social platforms actually present, most-saved first.
  const platformCounts = useMemo(() => {
    const counts = new Map<SocialPlatform, number>();
    for (const it of bookmarked) {
      if (it.kind === 'social') counts.set(it.social.platform, (counts.get(it.social.platform) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [bookmarked]);

  // If the active platform's last bookmark is removed, fall back to "All" at
  // render time (no stale filter, no setState-in-effect).
  const effPlatform =
    activePlatform && platformCounts.some(([p]) => p === activePlatform) ? activePlatform : null;
  const filtered = useMemo(
    () =>
      effPlatform
        ? bookmarked.filter((it) => it.kind === 'social' && it.social.platform === effPlatform)
        : bookmarked,
    [bookmarked, effPlatform],
  );

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <PageHeading title="Bookmarks" description="Saved for quick access" count={bookmarked.length} />
          </View>
          {bookmarked.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              <Chip
                label="All"
                count={bookmarked.length}
                active={effPlatform === null}
                onPress={() => setActivePlatform(null)}
              />
              {platformCounts.map(([p, n]) => (
                <Chip
                  key={p}
                  platform={p}
                  label={platformLabel(p)}
                  count={n}
                  active={effPlatform === p}
                  onPress={() => setActivePlatform(effPlatform === p ? null : p)}
                />
              ))}
            </ScrollView>
          )}
        </CollapsibleHeader>

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.url}
          contentContainerStyle={[styles.listContent, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => <SavedUrlCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
          ListEmptyComponent={<EmptyState />}
        />

        <BackToTop
          visible={showTop}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          bottomOffset={-16}
        />
      </SafeAreaView>
    </View>
  );
}

function Chip({
  label,
  count,
  platform,
  active,
  onPress,
}: {
  label: string;
  count: number;
  platform?: SocialPlatform;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}>
      {platform && <Image source={PLATFORM_ICON[platform]} style={styles.chipIcon} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="bookmark-outline" size={30} color={palette.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No bookmarks yet</Text>
      <Text style={styles.emptyText}>
        Tap the bookmark icon on any post — or “Bookmark” in its ⋯ menu — to save it here for quick
        access.
      </Text>
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  chipRow: {
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: Spacing.two + 2,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  chipIcon: {
    width: 15,
    height: 15,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: palette.chipBg,
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textSecondary,
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },

  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: palette.textSecondary,
  },
});
