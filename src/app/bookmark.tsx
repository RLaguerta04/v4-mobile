import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityDetailModal } from '@/components/activity-detail-modal';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { ArticleActivityDetailModal } from '@/components/mediawatch/article-activity-detail';
import { NewActivityModal } from '@/components/new-activity-modal';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useArticleTracker } from '@/contexts/adwatch-tracker-context';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { useSocialTracker } from '@/contexts/social-tracker-context';
import { useTrackerActivities } from '@/contexts/tracker-context';
import { isArticleView } from '@/data/article-workspace';
import { ActivityType } from '@/data/types';
import { ResolvedActivity, resolveActivity } from '@/utils/metrics';

type IoniconName = keyof typeof Ionicons.glyphMap;
type TypeFilter = ActivityType | 'All Types';

const FILTER_OPTIONS: TypeFilter[] = [
  'All Types',
  'Press Release',
  'Crisis',
  'Product',
  'Trending',
  'Event',
];

// Each activity type gets an icon + accent, mirroring the web tracker's typed
// activity rows (Press Release / Crisis / Product / Trending / Event).
const ACTIVITY_META: Record<ActivityType, { icon: IoniconName; color: string }> = {
  'Press Release': { icon: 'document-text-outline', color: '#6B4DE8' },
  Crisis: { icon: 'warning-outline', color: '#E94F37' },
  Product: { icon: 'cube-outline', color: '#16A34A' },
  Trending: { icon: 'flame-outline', color: '#D97706' },
  Event: { icon: 'calendar-outline', color: '#2563EB' },
};

export default function BookmarkScreen() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { activeView } = useAuth();
  // Both article workspaces (MediaWatch news, AdWatch ads) use the article
  // tracker + article activity detail; SharedView uses the social ones.
  const isArticle = isArticleView(activeView);
  const { userActivities, addActivity } = useTrackerActivities();
  const { activities: articleActivities } = useArticleTracker();
  const { activities: socialActivities } = useSocialTracker();
  const [selected, setSelected] = useState<ResolvedActivity | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All Types');
  const [filterOpen, setFilterOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const [headerH, setHeaderH] = useState(120);

  // User-created activities first, then the authored set for the active
  // workspace. Both are kept live via their tracker contexts (MediaWatch article
  // coverage / SharedView social activities) so Add to Tracker edits show up here.
  const activities = useMemo(
    () => [...userActivities, ...(isArticle ? articleActivities : socialActivities)].map(resolveActivity),
    [userActivities, isArticle, articleActivities, socialActivities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter(
      (a) =>
        (typeFilter === 'All Types' || a.type === typeFilter) &&
        (q === '' ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)),
    );
  }, [activities, query, typeFilter]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <PageHeading
              title="Activity Tracker"
              description="Stories you're tracking"
              count={activities.length}
            />
          </View>
          <Pressable
            onPress={() => setNewOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="New activity"
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.newBtnText}>New</Text>
          </Pressable>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search activities…"
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
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by type: ${typeFilter}`}
            style={({ pressed }) => [
              styles.filterChip,
              typeFilter !== 'All Types' && styles.filterChipOn,
              pressed && styles.pressed,
            ]}>
            <Ionicons name="filter" size={14} color={theme.text} />
            <Text style={styles.filterChipText} numberOfLines={1}>
              {typeFilter}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
          </Pressable>
        </View>
        </CollapsibleHeader>

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <ActivityCard activity={item} onOpen={() => setSelected(item)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query || typeFilter !== 'All Types'
                ? 'No activities match your search.'
                : 'No tracked activities yet.'}
            </Text>
          }
        />

        <BackToTop
          visible={showTop}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          bottomOffset={-16}
        />
      </SafeAreaView>

      {isArticle ? (
        <ArticleActivityDetailModal activity={selected} onClose={() => setSelected(null)} />
      ) : (
        <ActivityDetailModal activity={selected} onClose={() => setSelected(null)} />
      )}
      <NewActivityModal
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={addActivity}
      />

      {/* Type filter menu */}
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
            <Text style={styles.menuTitle}>Filter by type</Text>
            {FILTER_OPTIONS.map((opt) => {
              const on = opt === typeFilter;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    setTypeFilter(opt);
                    setFilterOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
                  <Text style={[styles.menuRowText, on && styles.menuRowTextOn]}>{opt}</Text>
                  {on && <Ionicons name="checkmark" size={18} color={theme.text} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActivityCard({ activity, onOpen }: { activity: ResolvedActivity; onOpen: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const meta = ACTIVITY_META[activity.type];
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open activity: ${activity.title}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '1A' }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {activity.title}
          </Text>
          <Text style={styles.cardType}>
            {activity.type} · {activity.date}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>

      {activity.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {activity.description}
        </Text>
      ) : null}

      <View style={styles.cardMetaRow}>
        <Ionicons name="link-outline" size={13} color={theme.textSecondary} />
        <Text style={styles.metaText}>
          {activity.matchCount} {activity.matchCount === 1 ? 'match' : 'matches'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaValue}>{activity.value}</Text>
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
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    backgroundColor: t.inverse,
  },
  newBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 150,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  filterChipOn: {
    borderColor: t.text,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
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

  card: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMain: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: t.text,
  },
  cardType: {
    fontSize: 12,
    color: t.textSecondary,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: t.textSecondary,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: t.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: t.borderCool,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: t.positive,
  },

  // Type filter bottom-sheet menu
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
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
