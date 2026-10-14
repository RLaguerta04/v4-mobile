// Dashboard — the analytics view behind the "Dashboard" tab, ported 1:1 (by
// widget + interaction) from the web client's dashboard.html but computed from
// this app's own socialMentions + influencers (see docs/dashboard-spec.md and
// data/dashboard-metrics.ts). KPI grid, nine chart sections, a Top Influencers
// section, a platform filter, and tap-to-Explore drill-downs.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthorAvatar, PLATFORM_ICON } from '@/components/author-avatar';
import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { ShareBar, HBarList } from '@/components/dashboard/bars';
import { ChartArea, DbCard, Legend, RangeToggle } from '@/components/dashboard/chart-card';
import {
  BarLineChart,
  Donut,
  Histogram,
  ScatterPlot,
  StackedTimeBar,
  SwimlaneScatter,
} from '@/components/dashboard/charts';
import { CompareTopicsModal, CompareView } from '@/components/dashboard/compare-sheet';
import { ExploreSheet } from '@/components/dashboard/explore-sheet';
import { ExploreHeader, ExploreKind } from '@/components/dashboard/explore-panels';
import { buildInsightReport, InsightKind, InsightReport } from '@/components/dashboard/insights';
import { InsightsSheet } from '@/components/dashboard/insights-sheet';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import {
  chartTokens,
  formatCompact,
  PLATFORM_CHART_COLOR,
  PLATFORM_LABEL,
  PLATFORM_ORDER,
  SENTIMENT_COLOR,
} from '@/components/dashboard/palette';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { MediaWatchDashboard } from '@/components/mediawatch/dashboard-screen';
import {
  ALL_PLATFORMS,
  DEFAULT_FILTERS,
  filterMentions,
  MentionsFilters,
  MentionsFiltersSheet,
} from '@/components/mentions-filters-sheet';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { buildDashboard, KpiCard, mentionWeekStart, storyValue, totalEngagement } from '@/data/dashboard-metrics';
import { socialMentions } from '@/data/sample-data';
import { SocialMention, SocialPlatform } from '@/data/types';

const TL_RANGES = [
  { label: '3D', value: 3 },
  { label: '7D', value: 7 },
  { label: '15D', value: 15 },
  { label: '1M', value: 30 },
];

// Route dispatcher: MediaWatch shows the news-article analytics dashboard;
// every other view keeps the SharedView social dashboard below, unchanged.
export default function DashboardRoute() {
  const { activeView } = useAuth();
  return activeView === 'MediaWatch' ? <MediaWatchDashboard /> : <SharedViewDashboard />;
}

function SharedViewDashboard() {
  const { accentColor } = useAuth();
  const [filters, setFilters] = useState<MentionsFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [range, setRange] = useState(7);
  const [influencerTab, setInfluencerTab] = useState<'bubble' | 'bar'>('bubble');
  const [explore, setExplore] = useState<{
    kind: ExploreKind;
    title: string;
    mentions: SocialMention[];
    platform?: SocialPlatform;
  } | null>(null);
  const [drill, setDrill] = useState<{
    parentTitle: string;
    title: string;
    mentions: SocialMention[];
  } | null>(null);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [compareCats, setCompareCats] = useState<string[]>([]);
  const [insight, setInsight] = useState<InsightReport | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const [headerH, setHeaderH] = useState(124);

  const filtered = useMemo(() => filterMentions(socialMentions, filters), [filters]);
  const data = useMemo(() => buildDashboard(filtered), [filtered]);

  // The platform pill row and the sheet's Media Source share this one set, so
  // they stay in sync (no second, conflicting platform control).
  const allPlatformsSelected = filters.platforms.size === ALL_PLATFORMS.length;
  const platformSummary = allPlatformsSelected
    ? 'All platforms'
    : filters.platforms.size === 1
      ? PLATFORM_LABEL[[...filters.platforms][0]]
      : `${filters.platforms.size} platforms`;

  // Anything diverging from the defaults lights the filter-button dot.
  const hasActiveFilters =
    !allPlatformsSelected ||
    filters.topics.size > 0 ||
    filters.dateRange.start !== null ||
    filters.dateRange.end !== null ||
    filters.sortOrder !== 'newest';

  const timelineSlice = useMemo(() => data.timeline.slice(-range), [data.timeline, range]);

  // KPI cards: hide other-platform "Most Dominant" cards when a platform filter
  // is active (spec §1 filter behaviour).
  const visibleKpis = useMemo(
    () => data.kpis.filter((c) => !c.platform || filters.platforms.has(c.platform)),
    [data.kpis, filters.platforms],
  );

  function openExplore(kind: ExploreKind, title: string, mentions: SocialMention[], platform?: SocialPlatform) {
    setExplore({ kind, title, mentions, platform });
    setDrill(null);
  }

  // Compute the chart's Insights report from the same derived data the chart
  // shows (so the panel always agrees with the chart), then open the sheet.
  function openInsights(kind: InsightKind) {
    setInsight(buildInsightReport(kind, data, filtered, range));
  }

  function onKpiPress(c: KpiCard) {
    switch (c.explore) {
      case 'total':
        return openExplore('total', 'Total Posts Count', filtered);
      case 'topinf':
        return openExplore('topinf', 'Top Influencers', filtered);
      case 'mostengaging':
        return openExplore(
          'mostengaging',
          'Most Engaging Posts',
          [...filtered].sort((a, b) => totalEngagement(b) - totalEngagement(a)),
        );
      case 'topentities':
        return openExplore('topentities', 'Top Entities', filtered);
      case 'dom':
        return c.platform
          ? openExplore(
              'dom',
              `Most Dominant - ${PLATFORM_LABEL[c.platform]}`,
              filtered.filter((m) => m.platform === c.platform),
              c.platform,
            )
          : undefined;
    }
  }

  async function exportSummary() {
    const top = data.kpis.find((k) => k.key === 'topinf');
    const lines = [
      `Dashboard summary${allPlatformsSelected ? '' : ` — ${platformSummary}`}`,
      `Total results: ${filtered.length}`,
      top ? `Top influencer: ${top.value} (${top.detail})` : '',
      `Platforms: ${data.exposure.map((e) => `${e.label} ${e.count}`).join(', ')}`,
    ].filter(Boolean);
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/* Floating header — pinned, and hides on scroll down / shows on scroll up */}
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.pinnedHeader}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <PageHeading
                title="Dashboard"
                description={allPlatformsSelected ? 'Across all platforms' : platformSummary}
                count={filtered.length}
              />
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setFiltersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={hasActiveFilters ? 'Filters. Filters active' : 'Open filters'}
                hitSlop={8}
                style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}>
                <Ionicons name="options-outline" size={18} color={chartTokens.text} />
                {hasActiveFilters && (
                  <View style={[styles.filterDot, { backgroundColor: accentColor }]} />
                )}
              </Pressable>
              <Pressable
                onPress={() => setComparePickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Compare topics"
                hitSlop={8}
                style={({ pressed }) => [styles.compareBtn, pressed && styles.pressed]}>
                <Ionicons name="git-compare-outline" size={16} color={chartTokens.text} />
                <Text style={styles.compareBtnText}>Compare</Text>
              </Pressable>
              <Pressable
                onPress={exportSummary}
                accessibilityRole="button"
                accessibilityLabel="Export summary"
                hitSlop={8}
                style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}>
                <Ionicons name="share-outline" size={16} color="#FFFFFF" />
                <Text style={styles.exportText}>Export</Text>
              </Pressable>
            </View>
          </View>

          {/* Platform filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            <FilterChip
              label="All platforms"
              active={allPlatformsSelected}
              onPress={() => setFilters((f) => ({ ...f, platforms: new Set(ALL_PLATFORMS) }))}
            />
            {PLATFORM_ORDER.map((p) => {
              const soleActive = filters.platforms.size === 1 && filters.platforms.has(p);
              return (
                <FilterChip
                  key={p}
                  label={PLATFORM_LABEL[p]}
                  platform={p}
                  active={soleActive}
                  onPress={() =>
                    setFilters((f) => ({
                      ...f,
                      platforms: soleActive ? new Set(ALL_PLATFORMS) : new Set([p]),
                    }))
                  }
                />
              );
            })}
          </ScrollView>
          </View>
        </CollapsibleHeader>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: headerH + Spacing.three }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}>
          {/* KPI cards */}
          <KpiGrid cards={visibleKpis} onCardPress={onKpiPress} />

          {/* Timeline */}
          <DbCard
            title="Timeline"
            onInsights={() => openInsights('timeline')}
            onExplore={() => openExplore('total', 'Total Posts Count', filtered)}>
            <RangeToggle options={TL_RANGES} value={range} onChange={setRange} />
            <ChartArea height={240}>
              {(w) => (
                <BarLineChart
                  data={timelineSlice}
                  width={w}
                  height={240}
                  onSelectBar={(i) => {
                    const day = timelineSlice[i];
                    openExplore('generic', day.fullDate, filtered.filter((m) => m.date === day.fullDate));
                  }}
                />
              )}
            </ChartArea>
            <Legend
              items={[
                { label: 'Total Results', color: chartTokens.totalResults },
                { label: 'Total Story Value', color: chartTokens.storyValue },
                { label: 'Projected Average', color: '#9ca3af' },
              ]}
            />
          </DbCard>

          {/* Platform Exposure */}
          <DbCard
            title="Platform Exposure (Post Count)"
            onInsights={() => openInsights('exposure')}
            onExplore={() => openExplore('exposure', 'Platform Exposure', filtered)}>
            <ShareBar
              segments={data.exposure.map((e) => ({ label: e.label, value: e.count, color: e.color }))}
              onSelect={(i) => {
                const seg = data.exposure[i];
                openExplore('generic', seg.label, filtered.filter((m) => m.platform === seg.platform));
              }}
            />
            <Legend
              items={data.exposure.map((e) => ({ label: e.label, color: e.color, note: String(e.count) }))}
            />
          </DbCard>

          {/* Channel summary cards */}
          <View style={styles.channelGrid}>
            {data.channels.map((ch) => (
              <View key={ch.platform} style={styles.channelCard}>
                <View style={styles.channelHeader}>
                  <View style={[styles.channelIcon, { backgroundColor: `${ch.color}1A` }]}>
                    <Image source={PLATFORM_ICON[ch.platform]} style={styles.channelIconImg} />
                  </View>
                  <Text style={styles.channelLabel}>{ch.label}</Text>
                </View>
                {ch.stats.map((s) => (
                  <View key={s.label} style={styles.channelStat}>
                    <Text style={styles.channelStatLabel} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text style={[styles.channelStatVal, s.zero && styles.channelStatZero]}>{s.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Tonality Distribution */}
          <DbCard
            title="Tonality Distribution"
            onInsights={() => openInsights('tonality')}
            onExplore={() => openExplore('tonality', 'Tonality', filtered)}>
            <Legend
              items={data.tonalityDonut.map((t) => {
                const total = data.tonalityDonut.reduce((s, x) => s + x.value, 0) || 1;
                return { label: t.label, color: t.color, note: `${((t.value / total) * 100).toFixed(1)}% (${t.value})` };
              })}
            />
            <View style={styles.donutRow}>
              <Donut
                segments={data.tonalityDonut}
                size={170}
                selectedIndex={null}
                onSelectSlice={(i) => {
                  const s = data.tonalityDonut[i];
                  openExplore('generic', `${s.label} posts`, filtered.filter((m) => m.sentiment === s.sentiment));
                }}
              />
            </View>
            {data.tonalityTimeline.length > 0 ? (
              <ChartArea height={220}>
                {(w) => (
                  <StackedTimeBar
                    width={w}
                    height={220}
                    onSelectBar={(i) => {
                      const day = data.tonalityTimeline[i];
                      openExplore(
                        'generic',
                        `Week of ${day.label}`,
                        filtered.filter((m) => mentionWeekStart(m) === day.start),
                      );
                    }}
                    data={data.tonalityTimeline.map((d) => ({
                      label: d.label,
                      segments: [
                        { value: d.positive, color: SENTIMENT_COLOR.positive },
                        { value: d.neutral, color: SENTIMENT_COLOR.neutral },
                        { value: d.negative, color: SENTIMENT_COLOR.negative },
                      ],
                    }))}
                  />
                )}
              </ChartArea>
            ) : null}
          </DbCard>

          {/* Frequency Distribution */}
          <DbCard
            title="Frequency Distribution"
            onInsights={() => openInsights('frequency')}
            onExplore={() => openExplore('frequency', 'Frequency Distribution', filtered)}>
            <ChartArea height={240}>
              {(w) => (
                <Histogram
                  bars={data.frequency}
                  width={w}
                  height={240}
                  xLabel="Story Value"
                  yLabel="Post Count"
                  onSelectBar={(i) =>
                    openExplore(
                      'generic',
                      `Story value ${i}`,
                      filtered.filter((m) => Math.floor(storyValue(m)) === i),
                    )
                  }
                />
              )}
            </ChartArea>
          </DbCard>

          {/* Top Media Sources (swimlane) */}
          <DbCard
            title="Top Media Sources"
            onInsights={() => openInsights('topmedia')}
            onExplore={() => openExplore('topmedia', 'Top Media Sources', filtered)}>
            <ChartArea height={Math.max(160, data.swimlane.lanes.length * 44 + 40)}>
              {(w) => (
                <SwimlaneScatter
                  lanes={data.swimlane.lanes}
                  dots={data.swimlane.dots}
                  dayLabels={data.swimlane.dayLabels}
                  width={w}
                  height={Math.max(160, data.swimlane.lanes.length * 44 + 40)}
                  onSelectLane={(i) => {
                    const lane = data.swimlane.lanes[i];
                    openExplore('generic', lane.label, filtered.filter((m) => m.platform === lane.platform));
                  }}
                />
              )}
            </ChartArea>
          </DbCard>

          {/* Influencer Story Value Distribution */}
          <DbCard
            title="Influencer Story Value Distribution"
            onInsights={() => openInsights('influencer')}
            onExplore={() => openExplore('influencer', 'Influencer Story Value', filtered)}>
            <View style={styles.tabRow}>
              {(['bubble', 'bar'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setInfluencerTab(t)}
                  style={[styles.tab, influencerTab === t && styles.tabOn]}>
                  <Text style={[styles.tabText, influencerTab === t && styles.tabTextOn]}>
                    {t === 'bubble' ? 'Bubble Plot' : 'Bar Chart'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {influencerTab === 'bubble' ? (
              <ChartArea height={280}>
                {(w) => (
                  <ScatterPlot
                    width={w}
                    height={280}
                    xLabel="Post Count"
                    yLabel="Story Value"
                    points={data.influencerDist.map((d) => ({
                      x: d.posts,
                      y: d.sv,
                      r: 6 + d.score * 1.4,
                      color: d.color,
                    }))}
                    onSelectPoint={(i) => {
                      const inf = data.influencerDist[i];
                      openExplore('generic', inf.name, filtered.filter((m) => m.handle === inf.handle));
                    }}
                  />
                )}
              </ChartArea>
            ) : (
              <HBarList
                items={data.influencerDist.map((d) => ({ label: d.name, value: d.posts, color: d.color }))}
                valueFormatter={(v) => `${v}`}
                onSelect={(i) => {
                  const inf = data.influencerDist[i];
                  openExplore('generic', inf.name, filtered.filter((m) => m.handle === inf.handle));
                }}
              />
            )}
          </DbCard>

          {/* Media Source Distribution */}
          <DbCard
            title="Media Source Distribution"
            onInsights={() => openInsights('mediasource')}
            onExplore={() => openExplore('mediasource', 'Media Source Distribution', filtered)}>
            <ChartArea height={260}>
              {(w) => (
                <ScatterPlot
                  width={w}
                  height={260}
                  xLabel="Post Count"
                  yLabel="Story Value"
                  points={data.mediaSource.map((d) => ({ x: d.postCount, y: d.storyValue, r: 7, color: d.color }))}
                  onSelectPoint={(i) => {
                    const ms = data.mediaSource[i];
                    openExplore('generic', ms.label, filtered.filter((m) => m.platform === ms.platform));
                  }}
                />
              )}
            </ChartArea>
            <Legend items={data.mediaSource.map((d) => ({ label: d.label, color: d.color }))} />
          </DbCard>

          {/* Entities Map */}
          <DbCard
            title="Entities Map"
            onInsights={() => openInsights('entities')}
            onExplore={() => openExplore('topentities', 'Top Entities', filtered)}>
            <EntitiesTreemap
              tiles={data.entities}
              onSelect={(i) => {
                const ent = data.entities[i];
                openExplore('generic', ent.name, filtered.filter((m) => m.entities.includes(ent.name)));
              }}
            />
          </DbCard>

          {/* Top Influencers section (the influencer ranking, folded in) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Top Influencers</Text>
            {data.topInfluencers.map((inf) => (
              <Pressable
                key={inf.handle}
                onPress={() => openExplore('generic', inf.name, filtered.filter((m) => m.handle === inf.handle))}
                style={({ pressed }) => [styles.infRow, pressed && styles.pressed]}>
                <AuthorAvatar handle={inf.handle} platform={inf.platform} size={40} />
                <View style={styles.infIdentity}>
                  <Text style={styles.infName} numberOfLines={1}>
                    {inf.name}
                  </Text>
                  <Text style={styles.infMeta} numberOfLines={1}>
                    {formatCompact(inf.followers)} followers · eng {inf.engagementScore}
                  </Text>
                </View>
                <View style={[styles.infPostsPill, { backgroundColor: `${PLATFORM_CHART_COLOR[inf.platform]}1A` }]}>
                  <Text style={[styles.infPostsText, { color: PLATFORM_CHART_COLOR[inf.platform] }]}>
                    {inf.posts} {inf.posts === 1 ? 'post' : 'posts'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <BackToTop
          visible={showTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </SafeAreaView>

      <ExploreSheet
        visible={explore !== null}
        title={explore?.title ?? ''}
        mentions={explore?.mentions ?? []}
        header={
          explore ? (
            <ExploreHeader
              kind={explore.kind}
              mentions={explore.mentions}
              platform={explore.platform}
              onDrill={(label, ms) => setDrill({ parentTitle: explore.title, title: label, mentions: ms })}
            />
          ) : null
        }
        onClose={() => {
          setExplore(null);
          setDrill(null);
        }}
      />

      {/* Second-level drill-down: one graph element's posts, opened over the
          main Explore sheet (matches the web's sliding posts panel). */}
      <ExploreSheet
        visible={drill !== null}
        title={drill?.title ?? ''}
        overview={drill?.parentTitle}
        mentions={drill?.mentions ?? []}
        onClose={() => setDrill(null)}
      />

      <InsightsSheet
        report={insight}
        onClose={() => setInsight(null)}
        onDrill={(d) => {
          setInsight(null);
          openExplore('generic', d.title, filtered.filter(d.match));
        }}
      />

      <CompareTopicsModal
        visible={comparePickerOpen}
        onClose={() => setComparePickerOpen(false)}
        onCompare={(cats) => {
          setComparePickerOpen(false);
          setCompareCats(cats);
        }}
      />
      <CompareView cats={compareCats} onClose={() => setCompareCats([])} />

      <MentionsFiltersSheet
        visible={filtersOpen}
        initialFilters={filters}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

function FilterChip({
  label,
  platform,
  active,
  onPress,
}: {
  label: string;
  platform?: SocialPlatform;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}>
      {platform ? <Image source={PLATFORM_ICON[platform]} style={styles.chipIcon} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F4F0',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  // Inner header content (title + actions + filter chips). The floating/inset
  // behaviour lives in CollapsibleHeader; this just lays out + divides.
  pinnedHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: chartTokens.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: chartTokens.text,
  },
  subtitle: {
    fontSize: 13,
    color: chartTokens.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  filterBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 999,
  },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  compareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: chartTokens.text,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 7,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterRow: {
    gap: Spacing.one + 2,
    paddingVertical: 2,
    paddingRight: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: chartTokens.border,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  chipOn: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  chipIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: chartTokens.text,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  donutRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  channelCard: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: chartTokens.card,
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: 5,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  channelIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconImg: {
    width: 15,
    height: 15,
    borderRadius: 4,
  },
  channelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: chartTokens.text,
  },
  channelStat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  channelStatLabel: {
    flexShrink: 1,
    fontSize: 11,
    color: chartTokens.textSecondary,
  },
  channelStatVal: {
    fontSize: 12,
    fontWeight: '700',
    color: chartTokens.text,
  },
  channelStatZero: {
    color: chartTokens.axisText,
    fontWeight: '400',
  },
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2F1ED',
  },
  tabOn: {
    backgroundColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: chartTokens.textSecondary,
  },
  tabTextOn: {
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: chartTokens.card,
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: chartTokens.text,
    marginBottom: Spacing.one,
  },
  infRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  infIdentity: {
    flex: 1,
    gap: 2,
  },
  infName: {
    fontSize: 14,
    fontWeight: '600',
    color: chartTokens.text,
  },
  infMeta: {
    fontSize: 12,
    color: chartTokens.textSecondary,
  },
  infPostsPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  infPostsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
