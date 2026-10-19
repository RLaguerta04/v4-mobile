import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityDetailModal } from '@/components/activity-detail-modal';
import { AuthorAvatar } from '@/components/author-avatar';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { InfluencerDetailModal } from '@/components/influencer-detail-modal';
import { MediaWatchSearch } from '@/components/mediawatch/search-screen';
import { MentionCard } from '@/components/mention-card';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { useTrackerActivities } from '@/contexts/tracker-context';
import { isArticleView } from '@/data/article-workspace';
import { trackerActivities } from '@/data/sample-data';
import {
  globalSearch,
  RESULT_TYPE_ORDER,
  SearchResult,
  SearchResultType,
  searchSuggestions,
} from '@/utils/global-search';
import { buildInfluencers, Influencer } from '@/utils/influencers';
import { ResolvedActivity, resolveActivity } from '@/utils/metrics';

type IoniconName = keyof typeof Ionicons.glyphMap;

const TYPE_META: Record<SearchResultType, { label: string; icon: IoniconName; color: string }> = {
  post: { label: 'Posts', icon: 'chatbubble-ellipses', color: '#2563EB' },
  influencer: { label: 'Influencers', icon: 'star', color: '#6B4DE8' },
  category: { label: 'Categories', icon: 'pricetags', color: '#D97706' },
  activity: { label: 'Activities', icon: 'megaphone', color: '#E94F37' },
  folder: { label: 'Saved', icon: 'folder', color: '#16A34A' },
  trending: { label: 'Trending', icon: 'flame', color: '#DB2777' },
};

// How many of each type to preview in the grouped "All" view before "See all".
const PREVIEW_LIMIT: Record<SearchResultType, number> = {
  post: 2,
  influencer: 3,
  category: 4,
  activity: 3,
  folder: 4,
  trending: 3,
};

// Route dispatcher: the article workspaces (MediaWatch news, AdWatch ads) search
// the article corpus; others keep the SharedView global search below.
export default function SearchRoute() {
  const { activeView } = useAuth();
  return isArticleView(activeView) ? <MediaWatchSearch /> : <SharedViewSearch />;
}

function SharedViewSearch() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const router = useRouter();
  const accentColor = useAccentColor();
  const { isSaved, toggleSave } = useBookmarks();
  const { userActivities } = useTrackerActivities();
  const { folders, folderOfUrl } = useSavedArticles();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();

  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<SearchResultType | 'all'>('all');
  const [recent, setRecent] = useState<string[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ResolvedActivity | null>(null);
  const [headerH, setHeaderH] = useState(140);
  const scrollRef = useRef<ScrollView>(null);

  const influencers = useMemo(() => buildInfluencers(), []);
  const activities = useMemo(() => [...userActivities, ...trackerActivities], [userActivities]);
  const folderInputs = useMemo(
    () =>
      folders.map((f) => ({
        id: f.id,
        name: f.name,
        count: Object.values(folderOfUrl).filter((id) => id === f.id).length,
      })),
    [folders, folderOfUrl],
  );
  const suggestions = useMemo(() => searchSuggestions(), []);

  const results = useMemo(
    () => globalSearch(query, { influencers, activities, folders: folderInputs }),
    [query, influencers, activities, folderInputs],
  );

  const grouped = useMemo(() => {
    const map = new Map<SearchResultType, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return RESULT_TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, items: map.get(t) ?? [] }));
  }, [results]);

  function changeQuery(v: string) {
    setQuery(v);
    setActiveType('all');
  }
  function addRecent(v: string) {
    const t = v.trim();
    if (!t) return;
    setRecent((prev) => [t, ...prev.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6));
  }
  function removeRecent(v: string) {
    setRecent((prev) => prev.filter((r) => r !== v));
  }
  function openResult(r: SearchResult) {
    addRecent(query);
    switch (r.type) {
      case 'influencer':
        return setSelectedInfluencer(r.influencer);
      case 'activity':
        return setSelectedActivity(resolveActivity(r.activity));
      case 'category':
        return router.push('/categories');
      case 'folder':
        return router.push('/saved');
      case 'trending':
        return router.push('/brief');
      default:
        return undefined;
    }
  }

  function renderItem(r: SearchResult) {
    if (r.type === 'post') {
      return (
        <MentionCard
          key={r.id}
          mention={r.mention}
          saved={isSaved(r.mention.url)}
          onToggleSave={() => toggleSave(r.mention.url)}
        />
      );
    }
    return <ResultRow key={r.id} result={r} query={query} onPress={() => openResult(r)} />;
  }

  const hasQuery = query.trim().length > 0;
  const scoped = activeType === 'all' ? [] : results.filter((r) => r.type === activeType);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <PageHeading title="Search" description="Find anything across the app" />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={changeQuery}
              placeholder="Posts, influencers, categories, activities…"
              placeholderTextColor={theme.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => addRecent(query)}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => changeQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
          {hasQuery && results.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              <TypeChip
                label="All"
                count={results.length}
                active={activeType === 'all'}
                onPress={() => setActiveType('all')}
              />
              {grouped.map((g) => (
                <TypeChip
                  key={g.type}
                  label={TYPE_META[g.type].label}
                  count={g.items.length}
                  active={activeType === g.type}
                  onPress={() => setActiveType(g.type)}
                />
              ))}
            </ScrollView>
          )}
        </CollapsibleHeader>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}>
          {!hasQuery ? (
            <InitialState
              suggestions={suggestions}
              recent={recent}
              onPick={changeQuery}
              onRemove={removeRecent}
              onClearRecent={() => setRecent([])}
            />
          ) : results.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search" size={30} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No results for “{query.trim()}”.</Text>
              <Text style={styles.emptyHint}>Try a shorter or different keyword.</Text>
            </View>
          ) : activeType === 'all' ? (
            grouped.map((g) => {
              const meta = TYPE_META[g.type];
              const limit = PREVIEW_LIMIT[g.type];
              return (
                <View key={g.type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                    <Text style={styles.sectionTitle}>{meta.label}</Text>
                    <View style={[styles.sectionCount, { backgroundColor: `${meta.color}1A` }]}>
                      <Text style={[styles.sectionCountText, { color: meta.color }]}>{g.items.length}</Text>
                    </View>
                    <View style={styles.spacer} />
                    {g.items.length > limit && (
                      <Pressable onPress={() => setActiveType(g.type)} hitSlop={6} accessibilityRole="button">
                        <Text style={[styles.seeAll, { color: accentColor }]}>See all →</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={g.type === 'post' ? styles.postList : styles.rowList}>
                    {g.items.slice(0, limit).map(renderItem)}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={activeType === 'post' ? styles.postList : styles.rowList}>
              {scoped.map(renderItem)}
            </View>
          )}
        </ScrollView>

        <BackToTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
      </SafeAreaView>

      <InfluencerDetailModal influencer={selectedInfluencer} onClose={() => setSelectedInfluencer(null)} />
      <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
    </View>
  );
}

function TypeChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

// Bolds the matched substring of the title in the accent color.
function Highlight({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const accentColor = useAccentColor();
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {text.slice(0, i)}
      <Text style={{ color: accentColor, fontWeight: '700' }}>{text.slice(i, i + q.length)}</Text>
      {text.slice(i + q.length)}
    </Text>
  );
}

function ResultRow({
  result,
  query,
  onPress,
}: {
  result: SearchResult;
  query: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const meta = TYPE_META[result.type];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${meta.label.toLowerCase()}: ${result.title}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {result.type === 'influencer' ? (
        <AuthorAvatar handle={result.influencer.handle} platform={result.influencer.platform} size={40} />
      ) : (
        <View style={[styles.rowIcon, { backgroundColor: `${meta.color}1A` }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
      )}
      <View style={styles.rowMain}>
        <Highlight text={result.title} query={query} style={styles.rowTitle} numberOfLines={1} />
        <Text style={styles.rowSub} numberOfLines={1}>
          {result.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function InitialState({
  suggestions,
  recent,
  onPick,
  onRemove,
  onClearRecent,
}: {
  suggestions: string[];
  recent: string[];
  onPick: (q: string) => void;
  onRemove: (q: string) => void;
  onClearRecent: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  // Recent searches replace the suggestions once there's any history.
  if (recent.length > 0) {
    return (
      <View style={styles.initial}>
        <View style={styles.recentHeader}>
          <Text style={styles.initialLabel}>Recent</Text>
          <Pressable onPress={onClearRecent} hitSlop={6} accessibilityRole="button">
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
        <View style={styles.recentBlock}>
          {recent.map((r) => (
            <View key={r} style={styles.recentRow}>
              <Pressable
                onPress={() => onPick(r)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${r}`}
                style={({ pressed }) => [styles.recentMain, pressed && styles.pressed]}>
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.recentText} numberOfLines={1}>
                  {r}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onRemove(r)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${r} from recent searches`}
                style={({ pressed }) => [styles.recentRemove, pressed && styles.pressed]}>
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.initial}>
      <Text style={styles.initialLabel}>Try searching</Text>
      <View style={styles.suggestWrap}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.suggestChip, pressed && styles.pressed]}>
            <Ionicons name="sparkles-outline" size={13} color={theme.textSecondary} />
            <Text style={styles.suggestText}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.initialHint}>
        Search across posts, influencers, categories, activities, saved folders & trending stories.
      </Text>
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
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Spacing.three,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: t.text,
  },
  chipRow: {
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: Spacing.two + 2,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  chipActive: {
    backgroundColor: t.inverse,
    borderColor: t.inverse,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: t.track,
    alignItems: 'center',
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textSecondary,
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: t.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
  },
  postList: {
    gap: Spacing.four,
  },
  rowList: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: t.text,
  },
  rowSub: {
    fontSize: 12,
    color: t.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },

  emptyWrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: t.text,
  },
  emptyHint: {
    fontSize: 13,
    color: t.textSecondary,
  },

  initial: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  initialLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  suggestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
    borderRadius: 999,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.border,
  },
  suggestText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  recentBlock: {
    gap: Spacing.one,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: t.text,
  },
  recentRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialHint: {
    fontSize: 13,
    lineHeight: 19,
    color: t.textSecondary,
    marginTop: Spacing.two,
  },
});
