import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthorAvatar } from '@/components/author-avatar';
import { BarLineChart } from '@/components/dashboard/charts';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { MentionCard } from '@/components/mention-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { buildEntitiesMap } from '@/data/dashboard-metrics';
import {
  buildInfluencerPerformance,
  formatCompact,
  Influencer,
  PERF_RANGES,
  platformLabel,
} from '@/utils/influencers';

type IoniconName = keyof typeof Ionicons.glyphMap;
type TabKey = 'posts' | 'performance' | 'entities';

const DETAIL_TABS: { key: TabKey; label: string; icon: IoniconName }[] = [
  { key: 'posts', label: 'Posts', icon: 'list-outline' },
  { key: 'performance', label: 'Performance', icon: 'stats-chart-outline' },
  { key: 'entities', label: 'Entities', icon: 'pricetags-outline' },
];

export function InfluencerDetailModal({
  influencer,
  onClose,
}: {
  influencer: Influencer | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>('posts');

  function handleClose() {
    setTab('posts');
    onClose();
  }
  const dismiss = useDismissGesture(handleClose);

  const kpis = influencer
    ? [
        { value: String(influencer.influencerScore), label: 'Influencer Score' },
        { value: formatCompact(influencer.followers), label: 'Subscribers' },
        { value: String(influencer.postCount), label: 'Posts' },
        { value: String(influencer.engagementScore), label: 'Engagement' },
        { value: formatCompact(influencer.totalReach), label: 'Total reach' },
      ]
    : [];

  return (
    <Modal
      visible={influencer !== null}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={handleClose} title="Influencer" />
            </View>
          </GestureDetector>

          {influencer && (
            // stickyHeaderIndices targets child 2 = the tab bar (0 profile · 1 KPI grid · 2 tab bar).
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              onScroll={dismiss.onScroll}
              scrollEventThrottle={16}
              stickyHeaderIndices={[2]}>
            <View style={styles.profile}>
              <AuthorAvatar handle={influencer.handle} platform={influencer.platform} size={56} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {influencer.name}
                </Text>
                <Text style={styles.profileSub} numberOfLines={1}>
                  {influencer.handle} · {platformLabel(influencer.platform)}
                </Text>
              </View>
            </View>

            <View style={styles.kpiGrid}>
              {kpis.map((k) => (
                <View key={k.label} style={styles.kpiCell}>
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tabBar}>
              <View style={styles.tabRow}>
                {DETAIL_TABS.map((t) => {
                  const on = tab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={[styles.tab, on && styles.tabActive]}>
                      <Ionicons
                        name={t.icon}
                        size={15}
                        color={on ? theme.text : theme.textSecondary}
                      />
                      <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {tab === 'posts' && <PostsTab influencer={influencer} />}
            {tab === 'performance' && <PerformanceTab influencer={influencer} />}
            {tab === 'entities' && <EntitiesTab influencer={influencer} />}
            </ScrollView>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Posts tab: the influencer's own posts, as home-feed cards ──
function PostsTab({ influencer }: { influencer: Influencer }) {
  const styles = useThemedStyles(makeStyles);
  const { isSaved, toggleSave } = useBookmarks();
  if (!influencer.posts.length) {
    return <Text style={styles.empty}>No posts yet.</Text>;
  }
  return (
    <View style={styles.postList}>
      {influencer.posts.map((p) => (
        <MentionCard
          key={p.url}
          mention={p}
          saved={isSaved(p.url)}
          onToggleSave={() => toggleSave(p.url)}
        />
      ))}
    </View>
  );
}

// ── Performance tab: the web's trend chart (story-value band + result bars +
// projected-average line), reusing the Dashboard's BarLineChart. ──
const LEGEND: { kind: 'band' | 'bar' | 'line'; color: string; label: string }[] = [
  { kind: 'band', color: '#B9A4F7', label: 'Bollinger Bands' },
  { kind: 'bar', color: '#16A34A', label: 'Total Results Bar' },
  { kind: 'line', color: '#9CA3AF', label: 'Projected Average' },
  { kind: 'line', color: '#B9A4F7', label: 'Total Story Value' },
];

function PerformanceTab({ influencer }: { influencer: Influencer }) {
  const styles = useThemedStyles(makeStyles);
  const [days, setDays] = useState(7);
  const [width, setWidth] = useState(0);
  const data = buildInfluencerPerformance(influencer, days);
  return (
    <View style={styles.perf}>
      <View style={styles.rangeRow}>
        {PERF_RANGES.map((r) => {
          const on = r.days === days;
          return (
            <Pressable
              key={r.days}
              onPress={() => setDays(r.days)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.rangePill, on && styles.rangePillOn]}>
              <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={styles.chartCard}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && <BarLineChart data={data} width={width - Spacing.two * 2 - 2} height={240} />}
      </View>

      <View style={styles.legend}>
        {LEGEND.map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View
              style={
                l.kind === 'line'
                  ? [styles.legendLine, { backgroundColor: l.color }]
                  : [
                      styles.legendSwatch,
                      { backgroundColor: l.color, opacity: l.kind === 'band' ? 0.5 : 1 },
                    ]
              }
            />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Entities tab: what this influencer talks about ──
function EntitiesTab({ influencer }: { influencer: Influencer }) {
  const styles = useThemedStyles(makeStyles);
  const tiles = buildEntitiesMap(influencer.posts);
  if (!tiles.length) {
    return <Text style={styles.empty}>No entities detected.</Text>;
  }
  return (
    <View style={styles.entities}>
      <Text style={styles.sectionLabel}>Entities mentioned</Text>
      <EntitiesTreemap tiles={tiles} height={240} />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.surfaceWarm,
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: t.card,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.text,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 19,
    fontWeight: '800',
    color: t.text,
  },
  profileSub: {
    fontSize: 13,
    color: t.textSecondary,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  kpiCell: {
    flexBasis: '31%',
    flexGrow: 1,
    gap: 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: t.text,
  },
  kpiLabel: {
    fontSize: 11,
    color: t.textSecondary,
  },

  tabBar: {
    backgroundColor: t.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  tabRow: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flex: 1,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: t.text,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
  tabTextActive: {
    color: t.text,
  },

  empty: {
    textAlign: 'center',
    color: t.textSecondary,
    paddingVertical: Spacing.five,
  },

  // Posts
  postList: {
    gap: Spacing.five,
  },

  // Performance
  perf: {
    gap: Spacing.three,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  rangePill: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
  },
  // Lilac highlight for the selected range pill — kept as a fixed pastel tint
  // (self-contained, like the calendar range highlight); reads as a bright
  // chip on the dark surface rather than theming away.
  rangePillOn: {
    backgroundColor: '#EFEAFB',
    borderColor: '#6B4DE8',
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
  },
  rangeTextOn: {
    color: '#6B4DE8',
  },
  chartCard: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 10,
    borderRadius: 2,
  },
  legendLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 12,
    color: t.textSecondary,
  },

  // Entities
  entities: {
    gap: Spacing.two,
  },
});
