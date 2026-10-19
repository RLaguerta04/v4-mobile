import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-avatar';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { InfluencerDetailModal } from '@/components/influencer-detail-modal';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { SocialPlatform } from '@/data/types';
import {
  buildInfluencers,
  formatCompact,
  Influencer,
  InfluencerSort,
  INFLUENCER_SORTS,
  platformLabel,
  sortInfluencers,
} from '@/utils/influencers';

// Short labels for the sort chip (the sheet shows the full INFLUENCER_SORTS labels).
const SORT_SHORT: Record<InfluencerSort, string> = {
  score: 'Score',
  posts: 'Posts',
  reach: 'Reach',
  az: 'A–Z',
};

export default function InfluencersScreen() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [selected, setSelected] = useState<Influencer | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<InfluencerSort>('score');
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const [headerH, setHeaderH] = useState(120);

  const all = useMemo(() => buildInfluencers(), []);
  const presentPlatforms = useMemo(
    () => [...new Set(all.map((i) => i.platform))],
    [all],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = all.filter(
      (i) =>
        (platforms.size === 0 || platforms.has(i.platform)) &&
        (q === '' || i.name.toLowerCase().includes(q) || i.handle.toLowerCase().includes(q)),
    );
    return sortInfluencers(list, sort);
  }, [all, query, platforms, sort]);

  function togglePlatform(p: SocialPlatform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <View style={styles.headerMain}>
              <PageHeading
                title="Influencers"
                description="Ranked by influence"
                count={all.length}
              />
            </View>
          </View>

          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search influencers…"
                placeholderTextColor={theme.textSecondary}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => setSortOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${SORT_SHORT[sort]}`}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Ionicons name="swap-vertical" size={14} color={theme.text} />
              <Text style={styles.chipText} numberOfLines={1}>
                {SORT_SHORT[sort]}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setFilterOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Filter by platform"
              style={({ pressed }) => [
                styles.iconBtn,
                platforms.size > 0 && styles.iconBtnOn,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="filter" size={16} color={theme.text} />
              {platforms.size > 0 && <View style={styles.filterDot} />}
            </Pressable>
          </View>
        </CollapsibleHeader>

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.handle}
          contentContainerStyle={[styles.listContent, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <InfluencerRow influencer={item} onOpen={() => setSelected(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No influencers match your filters.</Text>
          }
        />

        <BackToTop
          visible={showTop}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          bottomOffset={-16}
        />
      </SafeAreaView>

      <InfluencerDetailModal influencer={selected} onClose={() => setSelected(null)} />

      {/* Sort menu */}
      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSortOpen(false)}>
        <View style={styles.menuContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSortOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close sort"
          />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Sort influencers</Text>
            {INFLUENCER_SORTS.map((opt) => {
              const on = opt.key === sort;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setSort(opt.key);
                    setSortOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
                  <Text style={[styles.menuRowText, on && styles.menuRowTextOn]}>{opt.label}</Text>
                  {on && <Ionicons name="checkmark" size={18} color={theme.text} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Platform filter */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.menuContainer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close filter"
          />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <View style={styles.menuTitleRow}>
              <Text style={styles.menuTitle}>Filter by platform</Text>
              {platforms.size > 0 && (
                <Pressable
                  onPress={() => setPlatforms(new Set())}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
            </View>
            {presentPlatforms.map((p) => {
              const on = platforms.has(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => togglePlatform(p)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
                  <Text style={[styles.menuRowText, on && styles.menuRowTextOn]}>
                    {platformLabel(p)}
                  </Text>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on ? theme.info : theme.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfluencerRow({ influencer, onOpen }: { influencer: Influencer; onOpen: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open influencer: ${influencer.name}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AuthorAvatar handle={influencer.handle} platform={influencer.platform} size={44} />
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {influencer.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {influencer.handle} · {influencer.postCount}{' '}
          {influencer.postCount === 1 ? 'post' : 'posts'}
        </Text>
      </View>
      <View style={styles.rowStat}>
        <Text style={styles.rowScore}>{influencer.influencerScore}</Text>
        <Text style={styles.rowStatLabel}>score</Text>
      </View>
      <View style={styles.rowStat}>
        <Text style={styles.rowReach}>{formatCompact(influencer.totalReach)}</Text>
        <Text style={styles.rowStatLabel}>reach</Text>
      </View>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerMain: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: t.text,
  },
  subtitle: {
    fontSize: 13,
    color: t.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },

  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: t.text,
    padding: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  iconBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
  },
  iconBtnOn: {
    borderColor: t.info,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: t.info,
  },

  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    color: t.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 14,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
  rowSub: {
    fontSize: 12,
    color: t.textSecondary,
  },
  rowStat: {
    alignItems: 'flex-end',
    minWidth: 44,
  },
  rowScore: {
    fontSize: 17,
    fontWeight: '800',
    color: t.info,
  },
  rowReach: {
    fontSize: 15,
    fontWeight: '700',
    color: t.positive,
  },
  rowStatLabel: {
    fontSize: 10,
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Bottom-sheet menus (sort + platform filter)
  menuContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: t.scrim,
  },
  menuSheet: {
    backgroundColor: t.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.borderCool,
    marginBottom: Spacing.two,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.one,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.info,
    marginBottom: Spacing.one,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two + 2,
  },
  menuRowText: {
    fontSize: 15,
    color: t.text,
  },
  menuRowTextOn: {
    fontWeight: '700',
  },
});
