// Publishers & Authors — one parameterized master/detail screen (web parity:
// publishers.html / authors.html are near-identical twins). `kind` selects the
// grouping (outlet vs author) and the score label; everything else is shared.
// Driven by buildPublishers / buildAuthors over newsArticles.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { BarLineChart } from '@/components/dashboard/charts';
import { ChartArea, DbCard, Legend, RangeToggle } from '@/components/dashboard/chart-card';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { SocialIconRow } from '@/components/mediawatch/article-ui';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { PageHeading } from '@/components/page-heading';
import { SheetHeader } from '@/components/sheet-header';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { buildArticleTimeline, buildEntitiesMap } from '@/data/article-dashboard-metrics';
import { newsArticles } from '@/data/mediawatch-articles';
import { buildAuthors, buildPublishers, formatAve } from '@/data/mediawatch-metrics';
import type { EntityStat } from '@/data/mediawatch-types';

type Kind = 'publisher' | 'author';
type Sort = 'score' | 'count' | 'ave' | 'az';

const AVATAR_COLORS = ['#E94F37', '#2563EB', '#7C3AED', '#0D9488', '#D97706', '#DB2777', '#16A34A', '#4F46E5'];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'score', label: 'Highest Score' },
  { value: 'count', label: 'Most Articles' },
  { value: 'ave', label: 'Highest AVE' },
  { value: 'az', label: 'Name (A–Z)' },
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function EntityScreen({ kind }: { kind: Kind }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const title = kind === 'publisher' ? 'Publishers' : 'Authors';
  const scoreLabel = kind === 'publisher' ? 'Pub Score' : 'Author Score';

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('score');
  const [sortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<EntityStat | null>(null);
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const [headerH, setHeaderH] = useState(140);
  const progress = useRef(new Animated.Value(0)).current;

  const entities = useMemo(() => (kind === 'publisher' ? buildPublishers(newsArticles) : buildAuthors(newsArticles)), [kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entities.filter((e) => q === '' || e.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'count':
          return b.count - a.count;
        case 'ave':
          return b.totalAve - a.totalAve;
        case 'az':
          return a.name.localeCompare(b.name);
        case 'score':
        default:
          return b.score - a.score;
      }
    });
  }, [entities, query, sort]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={progress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <PageHeading title={title} description={kind === 'publisher' ? 'By outlet' : 'By writer'} count={entities.length} />
          </View>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${title.toLowerCase()}…`}
                placeholderTextColor={theme.textSecondary}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => setSortOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Sort: ${SORTS.find((s) => s.value === sort)?.label}`}
              style={({ pressed }) => [styles.sortChip, pressed && styles.pressed]}>
              <Ionicons name="swap-vertical" size={14} color={theme.text} />
              <Text style={styles.sortChipText} numberOfLines={1}>
                {SORTS.find((s) => s.value === sort)?.label}
              </Text>
            </Pressable>
          </View>
        </CollapsibleHeader>

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(e) => e.name}
          contentContainerStyle={[styles.listContent, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScrollTop}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelected(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.avatar, { backgroundColor: hashColor(item.name) }]}>
                <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.count} {item.count === 1 ? 'article' : 'articles'}
                </Text>
              </View>
              <View style={styles.rowStat}>
                <Text style={styles.rowScore}>{item.score.toFixed(2)}</Text>
                <Text style={styles.rowStatLabel}>Score</Text>
              </View>
              <View style={styles.rowStat}>
                {/* Compact (drop the "PHP" prefix) so the column stays narrow and
                    fixed-width — matches the influencer list and keeps rows aligned. */}
                <Text style={styles.rowAve}>{formatAve(item.totalAve).replace(/^PHP\s*/, '')}</Text>
                <Text style={styles.rowStatLabel}>Total AVE</Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          ListEmptyComponent={<Text style={styles.empty}>No {title.toLowerCase()} match your search.</Text>}
        />

        <BackToTop visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} bottomOffset={-16} />
      </SafeAreaView>

      <EntityDetailModal kind={kind} scoreLabel={scoreLabel} entity={selected} onClose={() => setSelected(null)} />

      <Modal visible={sortOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSortOpen(false)}>
        <View style={styles.menuContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortOpen(false)} accessibilityRole="button" accessibilityLabel="Close sort" />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Sort by</Text>
            {SORTS.map((opt) => {
              const on = opt.value === sort;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setSort(opt.value);
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
    </View>
  );
}

type Tab = 'articles' | 'performance' | 'entities';
const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'articles', label: 'Articles', icon: 'list-outline' },
  { key: 'performance', label: 'Performance', icon: 'bar-chart-outline' },
  { key: 'entities', label: 'Entities', icon: 'pricetags-outline' },
];

function EntityDetailModal({
  kind,
  scoreLabel,
  entity,
  onClose,
}: {
  kind: Kind;
  scoreLabel: string;
  entity: EntityStat | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('articles');
  const [tlRange, setTlRange] = useState(7);
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const dismiss = useDismissGesture(handleClose);

  function handleClose() {
    setTab('articles');
    onClose();
  }

  const arts = useMemo(() => entity?.articles ?? [], [entity]);
  const timeline = useMemo(() => buildArticleTimeline(arts), [arts]);
  const timelineView = useMemo(() => timeline.slice(-tlRange), [timeline, tlRange]);
  const ents = useMemo(() => buildEntitiesMap(arts), [arts]);

  return (
    <Modal visible={entity !== null} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.detailScreen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={handleClose} title={kind === 'publisher' ? 'Publisher' : 'Author'} />
            </View>
          </GestureDetector>

          {entity && (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.detailBody}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                onScrollTop(e);
                dismiss.onScroll(e);
              }}
              scrollEventThrottle={16}
              stickyHeaderIndices={[1]}>
              <View style={styles.detailHeaderCard}>
                <View style={styles.detailHeadRow}>
                  <View style={[styles.detailAvatar, { backgroundColor: hashColor(entity.name) }]}>
                    <Text style={styles.detailAvatarText}>{entity.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.detailIdentity}>
                    <Text style={styles.detailName}>{entity.name}</Text>
                    {kind === 'publisher' && (
                      <Pressable
                        onPress={() => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(entity.name)}`)}
                        accessibilityRole="link"
                        style={({ pressed }) => [styles.visitRow, pressed && styles.pressed]}>
                        <Ionicons name="open-outline" size={13} color={theme.info} />
                        <Text style={styles.visitText}>Visit publisher</Text>
                      </Pressable>
                    )}
                    <SocialIconRow size={20} gap={6} style={styles.detailSocials} />
                  </View>
                </View>
                <View style={styles.statRow}>
                  <Stat label={scoreLabel} value={entity.score.toFixed(2)} />
                  <View style={styles.statDivider} />
                  <Stat label="Articles" value={String(entity.count)} />
                  <View style={styles.statDivider} />
                  <Stat label="Total AVE" value={formatAve(entity.totalAve)} />
                </View>
              </View>

              <View style={styles.tabBar}>
                <View style={styles.tabBarInner}>
                  {TABS.map((t) => {
                    const on = tab === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setTab(t.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={[styles.tab, on && styles.tabActive]}>
                        <Ionicons name={t.icon} size={15} color={on ? theme.text : theme.textSecondary} />
                        <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {tab === 'articles' && (
                <View style={styles.articleList}>
                  {arts.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </View>
              )}

              {tab === 'performance' && (
                <View style={styles.perf}>
                  <DbCard title="Timeline">
                    <RangeToggle
                      options={[
                        { label: '3D', value: 3 },
                        { label: '7D', value: 7 },
                        { label: '15D', value: 15 },
                        { label: '1M', value: 30 },
                      ]}
                      value={tlRange}
                      onChange={setTlRange}
                    />
                    <ChartArea height={240}>{(w) => <BarLineChart data={timelineView} width={w} height={240} />}</ChartArea>
                    <Legend
                      items={[
                        { label: 'Total Results', color: '#16A34A' },
                        { label: 'Total Story Value', color: '#B9A4F7' },
                        { label: 'Projected Average', color: '#9CA3AF' },
                        { label: 'Bollinger Bands', color: '#D9CEF9' },
                      ]}
                    />
                  </DbCard>
                </View>
              )}

              {tab === 'entities' && (
                <View style={styles.perf}>
                  <DbCard title="Entities in coverage">
                    {ents.length ? <EntitiesTreemap tiles={ents} /> : <Text style={styles.empty}>No entities.</Text>}
                  </DbCard>
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
        {entity && <BackToTop visible={showTop} anchor="safe" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  toolbar: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
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
  searchInput: { flex: 1, fontSize: 14, color: t.text, padding: 0 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 160,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  sortChipText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: t.text },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  // Card rows copied from the influencer list (influencers.tsx) — white card,
  // avatar + name/sub, then two labeled stat columns (Score / Total AVE).
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
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '700', color: t.text },
  rowMeta: { fontSize: 12, color: t.textSecondary },
  // Fixed width (not content-sized) so Score/Total AVE line up column-straight
  // across every row instead of zig-zagging with each value's width.
  rowStat: { width: 60, alignItems: 'flex-end' },
  rowScore: { fontSize: 17, fontWeight: '800', color: t.info },
  rowAve: { fontSize: 15, fontWeight: '700', color: t.positive },
  rowStatLabel: { fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  empty: { textAlign: 'center', color: t.textSecondary, paddingVertical: Spacing.four },
  pressed: { opacity: 0.6 },

  menuContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.scrim },
  menuSheet: { backgroundColor: t.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.five },
  menuHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.border, marginBottom: Spacing.two },
  menuTitle: { fontSize: 12, fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: Spacing.one },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two + 2 },
  menuRowText: { fontSize: 15, color: t.text },
  menuRowTextOn: { fontWeight: '700' },

  // Detail
  detailScreen: { flex: 1, backgroundColor: t.surfaceWarm },
  fill: { flex: 1 },
  detailBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  detailHeaderCard: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorderCool, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  detailHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detailAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  detailAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 20 },
  detailIdentity: { flex: 1, gap: 2 },
  detailName: { fontSize: 18, fontWeight: '700', color: t.text },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  visitText: { fontSize: 13, fontWeight: '600', color: t.info },
  detailSocials: { marginTop: Spacing.one },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, gap: 2, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: t.text },
  statLabel: { fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: t.borderCool, marginHorizontal: Spacing.two },
  tabBar: { backgroundColor: t.surfaceWarm, borderBottomWidth: 1, borderBottomColor: t.borderCool },
  tabBarInner: { flexDirection: 'row', gap: Spacing.three },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.two, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.text },
  tabText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
  tabTextActive: { color: t.text },
  articleList: { gap: Spacing.five },
  perf: { gap: Spacing.three },
});
