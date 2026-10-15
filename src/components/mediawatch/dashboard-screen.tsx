// MediaWatch Dashboard — the Dashboard-tab content when activeView is
// MediaWatch. Reuses every chart primitive from components/dashboard/* (KpiGrid,
// BarLineChart, ShareBar, Donut, StackedTimeBar, Histogram, HBarList,
// EntitiesTreemap, DbCard) driven by article-dashboard-metrics. Tapping a KPI,
// bar, slice, or tile opens the matching articles in an ArticleListSheet.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { HBarList, ShareBar } from '@/components/dashboard/bars';
import { BarLineChart, Donut, Histogram, ScatterPlot, StackedTimeBar, SwimlaneScatter } from '@/components/dashboard/charts';
import { ChartArea, DbCard, Legend, RangeToggle } from '@/components/dashboard/chart-card';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { SENTIMENT_LABEL } from '@/components/dashboard/palette';
import { InsightsSheet } from '@/components/dashboard/insights-sheet';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { PageHeading } from '@/components/page-heading';
import { ArticleListSheet } from '@/components/mediawatch/article-list-sheet';
import { ChannelCards } from '@/components/mediawatch/channel-cards';
import { CompareSheet } from '@/components/mediawatch/compare-sheet';
import { MEDIA_TYPE_META } from '@/components/mediawatch/article-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import {
  articleEmphasis,
  buildArticleKpis,
  buildArticleTimeline,
  buildAuthorBubbles,
  buildChannelCards,
  buildEntitiesMap,
  buildMediaExposure,
  buildPublisherBubbles,
  buildPublisherSwimlane,
  buildStoryValueHistogram,
  buildTonalityDonut,
  buildTonalityTimeline,
  buildTopAuthors,
  buildTopicEmphasis,
  buildTopPublishers,
} from '@/data/article-dashboard-metrics';
import { ArticleInsightKind, buildArticleInsightReport } from '@/data/article-insights';
import { newsArticles } from '@/data/mediawatch-articles';
import { mediaChannel } from '@/data/mediawatch-metrics';
import type { MediaChannel, NewsArticle } from '@/data/mediawatch-types';
import type { Sentiment } from '@/data/types';

const palette = { background: '#F5F4F0', text: '#1A1A1A', textSecondary: '#6B7280', pillBg: '#F0EEEA' };
const CHANNELS: (MediaChannel | 'All')[] = ['All', 'Online', 'TV', 'Print', 'Radio'];

type Explore = { title: string; subtitle?: string; articles: NewsArticle[] };

export function MediaWatchDashboard() {
  const { accentColor } = useAuth();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const scrollRef = useRef<ScrollView>(null);
  const [headerH, setHeaderH] = useState(120);
  const [channel, setChannel] = useState<MediaChannel | 'All'>('All');
  const [tlRange, setTlRange] = useState<number>(7);
  const [pubTab, setPubTab] = useState<'bubble' | 'bar'>('bubble');
  const [authorTab, setAuthorTab] = useState<'bubble' | 'bar'>('bubble');
  const [explore, setExplore] = useState<Explore | null>(null);
  const [insightKind, setInsightKind] = useState<ArticleInsightKind | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const articles = useMemo(
    () => (channel === 'All' ? newsArticles : newsArticles.filter((a) => mediaChannel(a.mediaType) === channel)),
    [channel],
  );

  const kpis = useMemo(() => buildArticleKpis(articles), [articles]);
  const timeline = useMemo(() => buildArticleTimeline(articles), [articles]);
  const timelineView = useMemo(() => timeline.slice(-tlRange), [timeline, tlRange]);
  const exposure = useMemo(() => buildMediaExposure(articles), [articles]);
  const emphasis = useMemo(() => buildTopicEmphasis(articles), [articles]);
  const channelCards = useMemo(() => buildChannelCards(articles), [articles]);
  const donut = useMemo(() => buildTonalityDonut(articles), [articles]);
  const tonalityWeeks = useMemo(() => buildTonalityTimeline(articles), [articles]);
  const histogram = useMemo(() => buildStoryValueHistogram(articles), [articles]);
  const topPubs = useMemo(() => buildTopPublishers(articles), [articles]);
  const topAuthors = useMemo(() => buildTopAuthors(articles), [articles]);
  const pubBubbles = useMemo(() => buildPublisherBubbles(articles), [articles]);
  const authorBubbles = useMemo(() => buildAuthorBubbles(articles), [articles]);
  const pubSwimlane = useMemo(() => buildPublisherSwimlane(articles), [articles]);
  const entities = useMemo(() => buildEntitiesMap(articles), [articles]);

  const insightReport = useMemo(
    () =>
      insightKind
        ? buildArticleInsightReport(insightKind, {
            timeline,
            range: tlRange,
            exposure,
            emphasis,
            donut,
            tonalityWeeks,
            histogram,
            pubBubbles,
            authorBubbles,
            pubSwimlane,
            entities,
          })
        : null,
    [insightKind, timeline, tlRange, exposure, emphasis, donut, tonalityWeeks, histogram, pubBubbles, authorBubbles, pubSwimlane, entities],
  );

  function openExplore(e: Explore) {
    if (e.articles.length) setExplore(e);
  }

  function exploreKpi(key: string) {
    if (key === 'total') return openExplore({ title: 'All Results', articles });
    if (key === 'ave') return openExplore({ title: 'All Results', subtitle: 'Sorted by AVE', articles: [...articles].sort((a, b) => b.ave - a.ave) });
    const idx = key.indexOf(':');
    const kind = key.slice(0, idx);
    const name = key.slice(idx + 1);
    switch (kind) {
      case 'pub':
        return openExplore({ title: name, articles: articles.filter((a) => a.outlet === name) });
      case 'author':
        return openExplore({ title: name, articles: articles.filter((a) => a.author === name) });
      case 'channel':
        return openExplore({ title: `${name} coverage`, articles: articles.filter((a) => mediaChannel(a.mediaType) === name) });
      case 'section':
        return openExplore({ title: name, articles: articles.filter((a) => a.section === name) });
      case 'sent':
        return openExplore({ title: `${SENTIMENT_LABEL[name as Sentiment]} articles`, articles: articles.filter((a) => a.sentiment === name) });
      case 'entity':
        return openExplore({ title: name, articles: articles.filter((a) => a.entities.includes(name)) });
      case 'day':
        return openExplore({ title: `Articles on ${name}`, articles: articles.filter((a) => a.date === name) });
    }
  }

  const total = articles.length;

  // Web parity: the toolbar's "Export to PDF" (display-only in the reference).
  // On mobile it shares a text snapshot of the dashboard's headline figures.
  function exportDashboard() {
    const lines = [
      `MediaWatch Dashboard — ${channel === 'All' ? 'All media' : channel}`,
      '',
      ...kpis.map((k) => `${k.label}: ${k.value}${k.detail ? ` (${k.detail})` : ''}`),
      '',
      'Tonality:',
      ...donut.map((d) => `  ${d.label}: ${d.value}`),
      '',
      'Top publishers:',
      ...topPubs.slice(0, 5).map((p, i) => `  ${i + 1}. ${p.label} — ${p.value} articles`),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={[styles.header, styles.headerRow]}>
            <PageHeading title="Dashboard" description="Coverage analytics" count={total} />
            <View style={styles.headerBtns}>
              <Pressable
                onPress={exportDashboard}
                accessibilityRole="button"
                accessibilityLabel="Export dashboard"
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="share-outline" size={16} color="#1A1A1A" />
              </Pressable>
              <Pressable
                onPress={() => setCompareOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Compare categories"
                style={({ pressed }) => [styles.compareBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="git-compare-outline" size={15} color="#FFFFFF" />
                <Text style={styles.compareBtnText}>Compare</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CHANNELS.map((ch) => {
              const on = ch === channel;
              return (
                <Pressable
                  key={ch}
                  onPress={() => setChannel(ch)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on && { backgroundColor: accentColor }]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{ch}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </CollapsibleHeader>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.body, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}>
          <KpiGrid cards={kpis} onCardPress={(c) => exploreKpi(c.key)} />

          <DbCard title="Timeline" onInsights={() => setInsightKind('timeline')} onExplore={() => exploreKpi('total')}>
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

          <DbCard
            title="Media Exposure"
            onInsights={() => setInsightKind('exposure')}
            onExplore={() => openExplore({ title: 'Media Exposure', articles })}>
            <ShareBar
              segments={exposure}
              onSelect={(i) => exploreKpi(`channel:${exposure[i].label}`)}
            />
            <Legend items={exposure.map((s) => ({ label: s.label, color: s.color, note: String(s.value) }))} />
          </DbCard>

          <DbCard
            title="Topic Emphasis"
            onInsights={() => setInsightKind('emphasis')}
            onExplore={() => openExplore({ title: 'Topic Emphasis', articles })}>
            <ShareBar
              segments={emphasis}
              onSelect={(i) =>
                openExplore({
                  title: `${emphasis[i].label} articles`,
                  articles: articles.filter((a) => articleEmphasis(a) === emphasis[i].label),
                })
              }
            />
            <Legend items={emphasis.map((s) => ({ label: s.label, color: s.color, note: String(s.value) }))} />
          </DbCard>

          <DbCard title="Media Type Breakdown">
            <ChannelCards
              cards={channelCards}
              onSelect={(c) =>
                openExplore({
                  title: `${MEDIA_TYPE_META[c.type].label} coverage`,
                  articles: articles.filter((a) => a.mediaType === c.type),
                })
              }
            />
          </DbCard>

          <DbCard
            title="Tonality"
            onInsights={() => setInsightKind('tonality')}
            onExplore={() => openExplore({ title: 'Tonality', articles })}>
            <View style={styles.donutWrap}>
              <ChartArea height={180}>
                {() => (
                  <Donut
                    segments={donut}
                    size={180}
                    centerValue={String(total)}
                    centerLabel="articles"
                    onSelectSlice={(i) => exploreKpi(`sent:${['positive', 'neutral', 'negative'][i]}`)}
                  />
                )}
              </ChartArea>
            </View>
            <Legend items={donut.map((s) => ({ label: s.label, color: s.color, note: String(s.value) }))} />
          </DbCard>

          {tonalityWeeks.length > 0 && (
            <DbCard
              title="Tonality over time"
              onInsights={() => setInsightKind('tonality')}
              onExplore={() => openExplore({ title: 'Tonality over time', articles })}>
              <ChartArea height={220}>{(w) => <StackedTimeBar data={tonalityWeeks} width={w} height={220} />}</ChartArea>
              <Legend
                items={[
                  { label: 'Positive', color: donut[0].color },
                  { label: 'Neutral', color: donut[1].color },
                  { label: 'Negative', color: donut[2].color },
                ]}
              />
            </DbCard>
          )}

          <DbCard
            title="Story Value Distribution"
            onInsights={() => setInsightKind('frequency')}
            onExplore={() => openExplore({ title: 'Story Value Distribution', articles })}>
            <ChartArea height={220}>
              {(w) => (
                <Histogram
                  bars={histogram}
                  width={w}
                  height={220}
                  xLabel="Story Value"
                  onSelectBar={(i) =>
                    openExplore({
                      title: `Story Value ${i}`,
                      articles: articles.filter((a) => Math.floor(a.storyValue) === i),
                    })
                  }
                />
              )}
            </ChartArea>
          </DbCard>

          <DbCard
            title="Publisher Score Distribution"
            onInsights={() => setInsightKind('pubscore')}
            onExplore={() => openExplore({ title: 'Publisher Score Distribution', articles })}>
            <View style={styles.tabRow}>
              {(['bubble', 'bar'] as const).map((t) => (
                <Pressable key={t} onPress={() => setPubTab(t)} style={[styles.tab, pubTab === t && styles.tabOn]}>
                  <Text style={[styles.tabText, pubTab === t && styles.tabTextOn]}>
                    {t === 'bubble' ? 'Bubble Plot' : 'Bar Chart'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pubTab === 'bubble' ? (
              <ChartArea height={280}>
                {(w) => (
                  <ScatterPlot
                    width={w}
                    height={280}
                    xLabel="Article Count"
                    yLabel="Story Value"
                    points={pubBubbles.map((d) => ({ x: d.articles, y: d.storyValue, r: 6 + d.score * 0.8, color: d.color }))}
                    onSelectPoint={(i) => exploreKpi(`pub:${pubBubbles[i].name}`)}
                  />
                )}
              </ChartArea>
            ) : (
              <HBarList items={topPubs} valueFormatter={(v) => String(v)} onSelect={(i) => exploreKpi(`pub:${topPubs[i].label}`)} />
            )}
          </DbCard>

          <DbCard
            title="Author Story Value Distribution"
            onInsights={() => setInsightKind('author')}
            onExplore={() => openExplore({ title: 'Author Story Value Distribution', articles })}>
            <View style={styles.tabRow}>
              {(['bubble', 'bar'] as const).map((t) => (
                <Pressable key={t} onPress={() => setAuthorTab(t)} style={[styles.tab, authorTab === t && styles.tabOn]}>
                  <Text style={[styles.tabText, authorTab === t && styles.tabTextOn]}>
                    {t === 'bubble' ? 'Bubble Plot' : 'Bar Chart'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {authorTab === 'bubble' ? (
              <ChartArea height={280}>
                {(w) => (
                  <ScatterPlot
                    width={w}
                    height={280}
                    xLabel="Article Count"
                    yLabel="Story Value"
                    points={authorBubbles.map((d) => ({ x: d.articles, y: d.storyValue, r: 6 + d.score * 0.8, color: d.color }))}
                    onSelectPoint={(i) => exploreKpi(`author:${authorBubbles[i].name}`)}
                  />
                )}
              </ChartArea>
            ) : (
              <HBarList items={topAuthors} valueFormatter={(v) => String(v)} onSelect={(i) => exploreKpi(`author:${topAuthors[i].label}`)} />
            )}
          </DbCard>

          {pubSwimlane.lanes.length > 0 && (
            <DbCard
              title="Top Publishers"
              onInsights={() => setInsightKind('toppub')}
              onExplore={() => openExplore({ title: 'Top Publishers', articles })}>
              <ChartArea height={Math.max(160, pubSwimlane.lanes.length * 40 + 40)}>
                {(w) => (
                  <SwimlaneScatter
                    lanes={pubSwimlane.lanes}
                    dots={pubSwimlane.dots}
                    dayLabels={pubSwimlane.dayLabels}
                    width={w}
                    height={Math.max(160, pubSwimlane.lanes.length * 40 + 40)}
                    onSelectLane={(i) => exploreKpi(`pub:${pubSwimlane.lanes[i].label}`)}
                  />
                )}
              </ChartArea>
            </DbCard>
          )}

          <DbCard
            title="Entities Map"
            onInsights={() => setInsightKind('entities')}
            onExplore={() => openExplore({ title: 'Entities Map', articles })}>
            <EntitiesTreemap tiles={entities} onSelect={(i) => exploreKpi(`entity:${entities[i].name}`)} />
            <Legend items={entities.map((e) => ({ label: e.name, color: e.color }))} />
          </DbCard>
        </ScrollView>

        <BackToTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} bottomOffset={-16} />
      </SafeAreaView>

      <ArticleListSheet
        visible={explore !== null}
        title={explore?.title ?? ''}
        subtitle={explore?.subtitle}
        articles={explore?.articles ?? []}
        onClose={() => setExplore(null)}
      />

      <InsightsSheet report={insightReport} onClose={() => setInsightKind(null)} onDrill={() => setInsightKind(null)} />

      <CompareSheet visible={compareOpen} onClose={() => setCompareOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 0 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E6EA',
    backgroundColor: '#FFFFFF',
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    flexShrink: 0,
  },
  compareBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  chipRow: { paddingHorizontal: Spacing.three, gap: Spacing.one, paddingBottom: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: palette.pillBg },
  chipText: { fontSize: 13, fontWeight: '600', color: palette.text },
  chipTextOn: { color: '#FFFFFF' },
  body: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three, gap: Spacing.three },
  donutWrap: { alignItems: 'center' },
  tabRow: { flexDirection: 'row', gap: Spacing.one, marginBottom: Spacing.one },
  tab: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F2F1ED' },
  tabOn: { backgroundColor: '#1A1A1A' },
  tabText: { fontSize: 12, fontWeight: '600', color: palette.textSecondary },
  tabTextOn: { color: '#FFFFFF' },
});
