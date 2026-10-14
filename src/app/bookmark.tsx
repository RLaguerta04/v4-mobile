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
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { useTrackerActivities } from '@/contexts/tracker-context';
import { mediawatchActivities } from '@/data/mediawatch-articles';
import { trackerActivities } from '@/data/sample-data';
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

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E4E6EA',
};

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
  const { activeView } = useAuth();
  const isMediaWatch = activeView === 'MediaWatch';
  const { userActivities, addActivity } = useTrackerActivities();
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
  // workspace (MediaWatch article coverage vs SharedView social activities).
  const activities = useMemo(
    () => [...userActivities, ...(isMediaWatch ? mediawatchActivities : trackerActivities)].map(resolveActivity),
    [userActivities, isMediaWatch],
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
            <Ionicons name="search" size={16} color={palette.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search activities…"
              placeholderTextColor={palette.textSecondary}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={palette.textSecondary} />
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
            <Ionicons name="filter" size={14} color={palette.text} />
            <Text style={styles.filterChipText} numberOfLines={1}>
              {typeFilter}
            </Text>
            <Ionicons name="chevron-down" size={14} color={palette.textSecondary} />
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

      {isMediaWatch ? (
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
                  {on && <Ionicons name="checkmark" size={18} color={palette.text} />}
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
        <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
      </View>

      {activity.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {activity.description}
        </Text>
      ) : null}

      <View style={styles.cardMetaRow}>
        <Ionicons name="link-outline" size={13} color={palette.textSecondary} />
        <Text style={styles.metaText}>
          {activity.matchCount} {activity.matchCount === 1 ? 'match' : 'matches'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaValue}>{activity.value}</Text>
      </View>
    </Pressable>
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
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    backgroundColor: palette.text,
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
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: palette.text,
    padding: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 150,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  filterChipOn: {
    borderColor: palette.text,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },

  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },

  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
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
    color: palette.text,
  },
  cardType: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.textSecondary,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: palette.border,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },

  // Type filter bottom-sheet menu
  menuContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
  },
  menuSheet: {
    backgroundColor: palette.card,
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
    backgroundColor: palette.border,
    marginBottom: Spacing.two,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textSecondary,
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
    color: palette.text,
  },
  menuRowTextOn: {
    fontWeight: '700',
  },
});
