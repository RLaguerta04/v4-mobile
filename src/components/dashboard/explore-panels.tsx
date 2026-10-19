// Explore drill-down headers (spec §10) — the charts shown above the post list
// inside the ExploreSheet, composed per drill-down "kind" from the shared
// primitives. Each panel mirrors its web counterpart (Top Influencers bar,
// Story Value bubble, Frequency histogram, Entities map, etc.) but computed
// from the mentions handed to it.
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthorAvatar, PLATFORM_ICON } from '@/components/author-avatar';
import { HBarList, HBarItem, ShareBar } from '@/components/dashboard/bars';
import { ChartArea, DbCard, Legend } from '@/components/dashboard/chart-card';
import { Donut, Histogram, ScatterPlot, StackedTimeBar } from '@/components/dashboard/charts';
import {
  PLATFORM_CHART_COLOR,
  PLATFORM_LABEL,
  SENTIMENT_COLOR,
} from '@/components/dashboard/palette';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import {
  buildEntitiesMap,
  buildExposure,
  buildFrequency,
  buildInfluencerDistribution,
  buildTonalityDonut,
  buildTonalityTimeline,
  storyValue,
  totalEngagement,
} from '@/data/dashboard-metrics';
import { influencers as INFLUENCERS } from '@/data/sample-data';
import { SocialMention, SocialPlatform } from '@/data/types';
import { Spacing, Theme } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type ExploreKind =
  | 'total'
  | 'topinf'
  | 'mostengaging'
  | 'dom'
  | 'topentities'
  | 'tonality'
  | 'exposure'
  | 'frequency'
  | 'influencer'
  | 'mediasource'
  | 'topmedia'
  | 'generic';

// Tapping any chart element drills into a second-level sheet of just that
// element's posts. The charts hand back a label + the filtered mentions.
type Drill = (label: string, mentions: SocialMention[]) => void;
const byHandle = (ms: SocialMention[], h: string) => ms.filter((m) => m.handle === h);
const byPlatform = (ms: SocialMention[], p: SocialPlatform) => ms.filter((m) => m.platform === p);
const byEntity = (ms: SocialMention[], e: string) => ms.filter((m) => m.entities.includes(e));

// Top accounts in a set, by post count — the web's "Top Influencers" bar.
function topInfluencerItems(ms: SocialMention[]): HBarItem[] {
  const g = new Map<string, { count: number; platform: SocialPlatform }>();
  ms.forEach((m) => {
    const e = g.get(m.handle);
    if (e) e.count += 1;
    else g.set(m.handle, { count: 1, platform: m.platform });
  });
  return [...g.entries()]
    .map(([handle, v]) => ({ label: handle, value: v.count, color: PLATFORM_CHART_COLOR[v.platform] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

// Top accounts by summed engagement — the web's "Top Profiles by Eng. Score".
function topEngagementItems(ms: SocialMention[]): HBarItem[] {
  const g = new Map<string, { eng: number; platform: SocialPlatform }>();
  ms.forEach((m) => {
    const e = g.get(m.handle);
    if (e) e.eng += totalEngagement(m);
    else g.set(m.handle, { eng: totalEngagement(m), platform: m.platform });
  });
  return [...g.entries()]
    .map(([handle, v]) => ({ label: handle, value: v.eng, color: PLATFORM_CHART_COLOR[v.platform] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function entityItems(ms: SocialMention[]): HBarItem[] {
  const counts = new Map<string, number>();
  ms.forEach((m) => m.entities.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  return [...counts.entries()]
    .map(([name, value]) => ({ label: name, value, color: PLATFORM_CHART_COLOR.facebook }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function InfluencerBubble({ ms, onDrill }: { ms: SocialMention[]; onDrill?: Drill }) {
  const dist = buildInfluencerDistribution(ms, INFLUENCERS).filter((d) =>
    ms.some((m) => m.handle === d.handle),
  );
  if (dist.length === 0) return null;
  return (
    <ChartArea height={260}>
      {(w) => (
        <ScatterPlot
          width={w}
          height={260}
          xLabel="Post Count"
          yLabel="Story Value"
          points={dist.map((d) => ({ x: d.posts, y: d.sv, r: 6 + d.score * 1.4, color: d.color }))}
          onSelectPoint={onDrill ? (i) => onDrill(dist[i].name, byHandle(ms, dist[i].handle)) : undefined}
        />
      )}
    </ChartArea>
  );
}

// Per-platform post-count cards — the web drill-down's platform grid. Skipped
// for a single-platform set (the "Most Dominant" drill-downs), as on the web.
function PlatformGrid({ ms, onDrill }: { ms: SocialMention[]; onDrill?: Drill }) {
  const styles = useThemedStyles(makeStyles);
  const exposure = buildExposure(ms);
  if (exposure.length <= 1) return null;
  return (
    <DbCard title="By platform">
      <View style={styles.platGrid}>
        {exposure.map((e) => (
          <Pressable
            key={e.platform}
            disabled={!onDrill}
            onPress={() => onDrill?.(e.label, byPlatform(ms, e.platform))}
            style={({ pressed }) => [styles.platCard, pressed && onDrill && styles.pressed]}>
            <View style={styles.platHead}>
              <Image source={PLATFORM_ICON[e.platform]} style={styles.platIcon} />
              <Text style={styles.platLabel} numberOfLines={1}>
                {e.label}
              </Text>
            </View>
            <Text style={styles.platCount}>{e.count}</Text>
            <Text style={styles.platSub}>{e.count === 1 ? 'post' : 'posts'}</Text>
          </Pressable>
        ))}
      </View>
    </DbCard>
  );
}

// Top accounts in the set as avatar cards — the web drill-down's influencer cards.
function influencerCardItems(
  ms: SocialMention[],
): { handle: string; platform: SocialPlatform; posts: number }[] {
  const g = new Map<string, { posts: number; platform: SocialPlatform }>();
  ms.forEach((m) => {
    const e = g.get(m.handle);
    if (e) e.posts += 1;
    else g.set(m.handle, { posts: 1, platform: m.platform });
  });
  return [...g.entries()]
    .map(([handle, v]) => ({ handle, platform: v.platform, posts: v.posts }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 8);
}

function InfluencerCards({ ms, onDrill }: { ms: SocialMention[]; onDrill?: Drill }) {
  const styles = useThemedStyles(makeStyles);
  const items = influencerCardItems(ms);
  if (!items.length) return null;
  return (
    <DbCard title="Top accounts">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.infCardsRow}>
        {items.map((inf) => (
          <Pressable
            key={inf.handle}
            disabled={!onDrill}
            onPress={() => onDrill?.(inf.handle, byHandle(ms, inf.handle))}
            style={({ pressed }) => [styles.infCard, pressed && onDrill && styles.pressed]}>
            <AuthorAvatar handle={inf.handle} platform={inf.platform} size={40} />
            <Text style={styles.infCardName} numberOfLines={1}>
              {inf.handle}
            </Text>
            <Text style={styles.infCardMeta}>
              {inf.posts} {inf.posts === 1 ? 'post' : 'posts'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </DbCard>
  );
}

export function ExploreHeader({
  kind,
  mentions,
  platform,
  onDrill,
}: {
  kind: ExploreKind;
  mentions: SocialMention[];
  platform?: SocialPlatform;
  onDrill?: Drill;
}) {
  const styles = useThemedStyles(makeStyles);
  switch (kind) {
    case 'total':
    case 'exposure': {
      const exposure = buildExposure(mentions);
      const topInf = topInfluencerItems(mentions);
      return (
        <View style={styles.stack}>
          <DbCard title="Platform Exposure (Post Count)">
            <ShareBar
              segments={exposure.map((e) => ({ label: e.label, value: e.count, color: e.color }))}
              onSelect={onDrill ? (i) => onDrill(exposure[i].label, byPlatform(mentions, exposure[i].platform)) : undefined}
            />
            <Legend items={exposure.map((e) => ({ label: e.label, color: e.color, note: String(e.count) }))} />
          </DbCard>
          <DbCard title="Top Influencers">
            <HBarList
              items={topInf}
              valueFormatter={(v) => `${v}`}
              onSelect={onDrill ? (i) => onDrill(topInf[i].label, byHandle(mentions, topInf[i].label)) : undefined}
            />
          </DbCard>
          <PlatformGrid ms={mentions} onDrill={onDrill} />
          <InfluencerCards ms={mentions} onDrill={onDrill} />
        </View>
      );
    }
    case 'topinf':
    case 'influencer': {
      const topInf = topInfluencerItems(mentions);
      return (
        <View style={styles.stack}>
          <DbCard title="Top Influencers">
            <HBarList
              items={topInf}
              valueFormatter={(v) => `${v}`}
              onSelect={onDrill ? (i) => onDrill(topInf[i].label, byHandle(mentions, topInf[i].label)) : undefined}
            />
          </DbCard>
          <DbCard title="Influencer Story Value Distribution">
            <InfluencerBubble ms={mentions} onDrill={onDrill} />
          </DbCard>
          <PlatformGrid ms={mentions} onDrill={onDrill} />
          <InfluencerCards ms={mentions} onDrill={onDrill} />
        </View>
      );
    }
    case 'mostengaging': {
      const topEng = topEngagementItems(mentions);
      return (
        <View style={styles.stack}>
          <DbCard title="Top Profiles by Engagement">
            <HBarList
              items={topEng}
              onSelect={onDrill ? (i) => onDrill(topEng[i].label, byHandle(mentions, topEng[i].label)) : undefined}
            />
          </DbCard>
          <FrequencyCard ms={mentions} title="Frequency Distribution of Posts" onDrill={onDrill} />
          <PlatformGrid ms={mentions} onDrill={onDrill} />
          <InfluencerCards ms={mentions} onDrill={onDrill} />
        </View>
      );
    }
    case 'dom': {
      const label = platform ? PLATFORM_LABEL[platform] : '';
      const topInf = topInfluencerItems(mentions);
      return (
        <View style={styles.stack}>
          <DbCard title={`Top Influencers${label ? ` — ${label}` : ''}`}>
            <HBarList
              items={topInf}
              valueFormatter={(v) => `${v}`}
              barColor={platform ? PLATFORM_CHART_COLOR[platform] : undefined}
              onSelect={onDrill ? (i) => onDrill(topInf[i].label, byHandle(mentions, topInf[i].label)) : undefined}
            />
          </DbCard>
          <DbCard title={`${label} Story Value Distribution`}>
            <InfluencerBubble ms={mentions} onDrill={onDrill} />
          </DbCard>
          <FrequencyCard ms={mentions} title={`${label} Posts Distribution`} onDrill={onDrill} />
          <InfluencerCards ms={mentions} onDrill={onDrill} />
        </View>
      );
    }
    case 'topentities': {
      const tiles = buildEntitiesMap(mentions);
      const ents = entityItems(mentions);
      return (
        <View style={styles.stack}>
          <DbCard title="Top Entities">
            <HBarList
              items={ents}
              valueFormatter={(v) => `${v}`}
              onSelect={onDrill ? (i) => onDrill(ents[i].label, byEntity(mentions, ents[i].label)) : undefined}
            />
          </DbCard>
          <DbCard title="Entities Map">
            <EntitiesTreemap
              tiles={tiles}
              onSelect={onDrill ? (i) => onDrill(tiles[i].name, byEntity(mentions, tiles[i].name)) : undefined}
            />
          </DbCard>
        </View>
      );
    }
    case 'tonality': {
      const donut = buildTonalityDonut(mentions);
      const timeline = buildTonalityTimeline(mentions);
      const total = donut.reduce((s, x) => s + x.value, 0) || 1;
      return (
        <View style={styles.stack}>
          <DbCard title="Tonality Distribution">
            <Legend
              items={donut.map((t) => ({
                label: t.label,
                color: t.color,
                note: `${((t.value / total) * 100).toFixed(1)}% (${t.value})`,
              }))}
            />
            <View style={styles.center}>
              <Donut
                segments={donut}
                size={160}
                onSelectSlice={
                  onDrill ? (i) => onDrill(donut[i].label, mentions.filter((m) => m.sentiment === donut[i].sentiment)) : undefined
                }
              />
            </View>
            {timeline.length > 0 ? (
              <ChartArea height={200}>
                {(w) => (
                  <StackedTimeBar
                    width={w}
                    height={200}
                    data={timeline.map((d) => ({
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
        </View>
      );
    }
    case 'frequency':
      return (
        <View style={styles.stack}>
          <FrequencyCard ms={mentions} title="Frequency Distribution" onDrill={onDrill} />
        </View>
      );
    case 'mediasource':
    case 'topmedia':
    case 'generic':
    default:
      return null;
  }
}

function FrequencyCard({ ms, title, onDrill }: { ms: SocialMention[]; title: string; onDrill?: Drill }) {
  return (
    <DbCard title={title}>
      <ChartArea height={220}>
        {(w) => (
          <Histogram
            bars={buildFrequency(ms)}
            width={w}
            height={220}
            xLabel="Story Value"
            yLabel="Post Count"
            onSelectBar={
              onDrill
                ? (i) => onDrill(`Story value ${i}`, ms.filter((m) => Math.floor(storyValue(m)) === i))
                : undefined
            }
          />
        )}
      </ChartArea>
    </DbCard>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  center: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  platGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  platCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: t.topicBg,
    borderRadius: 10,
    padding: Spacing.two,
    gap: 2,
  },
  platHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platIcon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  platLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
  },
  platCount: {
    fontSize: 20,
    fontWeight: '800',
    color: t.text,
  },
  platSub: {
    fontSize: 11,
    color: t.textSecondary,
  },
  infCardsRow: {
    gap: Spacing.two,
    paddingVertical: 2,
  },
  infCard: {
    width: 92,
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.topicBg,
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  infCardName: {
    maxWidth: 84,
    fontSize: 12,
    fontWeight: '700',
    color: t.text,
  },
  infCardMeta: {
    fontSize: 11,
    color: t.textSecondary,
  },
});
