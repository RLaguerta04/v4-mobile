// MediaWatch Dashboard — the Dashboard-tab content when activeView is
// MediaWatch. Reuses every chart primitive from components/dashboard/* (KpiGrid,
// BarLineChart, ShareBar, Donut, StackedTimeBar, Histogram, HBarList,
// EntitiesTreemap, DbCard) driven by article-dashboard-metrics. Tapping a KPI,
// bar, slice, or tile opens the matching articles in an ArticleListSheet.
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { HBarList, ShareBar } from '@/components/dashboard/bars';
import { BarLineChart, Donut, Histogram, StackedTimeBar } from '@/components/dashboard/charts';
import { ChartArea, DbCard, Legend } from '@/components/dashboard/chart-card';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { SENTIMENT_LABEL } from '@/components/dashboard/palette';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { PageHeading } from '@/components/page-heading';
import { ArticleListSheet } from '@/components/mediawatch/article-list-sheet';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import {
  buildArticleKpis,
  buildArticleTimeline,
  buildEntitiesMap,
  buildMediaExposure,
  buildStoryValueHistogram,
  buildTonalityDonut,
  buildTonalityTimeline,
  buildTopAuthors,
  buildTopPublishers,
} from '@/data/article-dashboard-metrics';
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
  const [explore, setExplore] = useState<Explore | null>(null);

  const articles = useMemo(
    () => (channel === 'All' ? newsArticles : newsArticles.filter((a) => mediaChannel(a.mediaType) === channel)),
    [channel],
  );

  const kpis = useMemo(() => buildArticleKpis(articles), [articles]);
  const timeline = useMemo(() => buildArticleTimeline(articles), [articles]);
  const exposure = useMemo(() => buildMediaExposure(articles), [articles]);
  const donut = useMemo(() => buildTonalityDonut(articles), [articles]);
  const tonalityWeeks = useMemo(() => buildTonalityTimeline(articles), [articles]);
  const histogram = useMemo(() => buildStoryValueHistogram(articles), [articles]);
  const topPubs = useMemo(() => buildTopPublishers(articles), [articles]);
  const topAuthors = useMemo(() => buildTopAuthors(articles), [articles]);
  const entities = useMemo(() => buildEntitiesMap(articles), [articles]);

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
    }
  }

  const total = articles.length;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <PageHeading title="Dashboard" description="Coverage analytics" count={total} />
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

          <DbCard title="Timeline" onExplore={() => exploreKpi('total')}>
            <ChartArea height={240}>{(w) => <BarLineChart data={timeline} width={w} height={240} />}</ChartArea>
            <Legend
              items={[
                { label: 'Total Results', color: '#16A34A' },
                { label: 'Total Story Value', color: '#B9A4F7' },
              ]}
            />
          </DbCard>

          <DbCard title="Media Exposure">
            <ShareBar
              segments={exposure}
              onSelect={(i) => exploreKpi(`channel:${exposure[i].label}`)}
            />
            <Legend items={exposure.map((s) => ({ label: s.label, color: s.color, note: String(s.value) }))} />
          </DbCard>

          <DbCard title="Tonality">
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
            <DbCard title="Tonality over time">
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

          <DbCard title="Story Value Distribution">
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

          <DbCard title="Top Publishers">
            <HBarList
              items={topPubs}
              valueFormatter={(v) => String(v)}
              onSelect={(i) => exploreKpi(`pub:${topPubs[i].label}`)}
            />
          </DbCard>

          <DbCard title="Top Authors">
            <HBarList
              items={topAuthors}
              valueFormatter={(v) => String(v)}
              onSelect={(i) => exploreKpi(`author:${topAuthors[i].label}`)}
            />
          </DbCard>

          <DbCard title="Entities">
            <EntitiesTreemap tiles={entities} onSelect={(i) => exploreKpi(`entity:${entities[i].name}`)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  chipRow: { paddingHorizontal: Spacing.three, gap: Spacing.one, paddingBottom: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: palette.pillBg },
  chipText: { fontSize: 13, fontWeight: '600', color: palette.text },
  chipTextOn: { color: '#FFFFFF' },
  body: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three, gap: Spacing.three },
  donutWrap: { alignItems: 'center' },
});
