// MediaWatch Today's Brief (full page) — the article counterpart of brief.tsx.
// Same shell (header, Spotlight/Trending tabs, stat tiles, spotlight card,
// coverage list, expandable trending clusters) but article-native: stats come
// from deriveArticleBriefStats, coverage renders ArticleCards, and clusters use
// mediawatchTrending + articlesForEntities.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { SentimentPill } from '@/components/mediawatch/article-ui';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/contexts/theme-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useArticleWorkspace } from '@/data/article-workspace';
import { articlesForEntities, deriveArticleBriefStats, formatAve, sortByNewest } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';
import { bucketsForCategory, CATEGORY_TAXONOMY } from '@/data/taxonomy';

const TABS = [
  { key: 'spotlight', label: 'Spotlight' },
  { key: 'trending', label: 'Trending' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function MediaWatchBrief() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  // Small lilac spotlight/trending accents are too dark on the charcoal cards —
  // swap to the lightened lilac in dark (spec: scheme-aware lilac text).
  const lilac = isDark ? '#A78BFA' : '#6B4DE8';
  const router = useRouter();
  const ws = useArticleWorkspace();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [tab, setTab] = useState<TabKey>('spotlight');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done'>('idle');
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { hideProgress } = useTabBarVisibility();
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { isSaved, toggleSave } = useBookmarks();
  const dismiss = useDismissGesture(() => router.back());

  useFocusEffect(
    useCallback(() => {
      Animated.timing(hideProgress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      return () => {
        Animated.timing(hideProgress, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      };
    }, [hideProgress]),
  );

  const articles = useMemo(() => {
    if (!category) return ws.articles;
    const buckets = new Set(bucketsForCategory(category));
    return ws.articles.filter((a) => a.entities.some((e) => buckets.has(e)));
  }, [ws.articles, category]);

  const stats = useMemo(() => deriveArticleBriefStats(articles), [articles]);
  const ranked = useMemo(() => [...articles].sort((a, b) => b.storyValue - a.storyValue), [articles]);
  const spotlight = ranked[0];

  const relevantBuckets = useMemo(
    () => new Set(category ? bucketsForCategory(category) : CATEGORY_TAXONOMY.flatMap((c) => c.buckets.map((b) => b.name))),
    [category],
  );
  const matchScore = useCallback(
    (a: NewsArticle) => {
      if (a.entities.length === 0) return 60;
      const overlap = a.entities.filter((e) => relevantBuckets.has(e)).length / a.entities.length;
      return Math.round(60 + 38 * overlap);
    },
    [relevantBuckets],
  );

  const coverage = useMemo(
    () => ranked.filter((a) => a.id !== spotlight?.id).sort((x, y) => matchScore(y) - matchScore(x)),
    [ranked, spotlight, matchScore],
  );

  const resolvedStories = useMemo(
    () =>
      ws.trending
        .map((s) => ({ ...s, members: articlesForEntities(articles, s.entities).sort(sortByNewest) }))
        .filter((s) => s.members.length > 0),
    [ws.trending, articles],
  );

  function toggleStory(rank: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  }

  function generateReport() {
    if (aiState === 'loading') return;
    setAiState('loading');
    aiTimer.current = setTimeout(() => setAiState('done'), 900);
  }
  const briefSummary = spotlight
    ? `Today's brief${category ? ` — ${category}` : ''}: "${spotlight.title}" (${spotlight.outlet}) leads with Story Value ${spotlight.storyValue.toFixed(1)}.\n\n${spotlight.url}`
    : '';
  function sendNewsletter() {
    const subject = encodeURIComponent(`Today's brief${category ? ` — ${category}` : ''}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${encodeURIComponent(briefSummary)}`);
  }
  function exportBrief() {
    Share.share({ message: briefSummary }).catch(() => {});
  }

  const aiText = spotlight
    ? `Coverage today is led by ${stats.topOutlet} and skews ${stats.dominantSentiment} (${stats.sentimentSplit[stats.dominantSentiment]}% of tracked ${ws.nouns}), across ${stats.total} ${ws.adMode ? 'placements' : 'pickups'} worth ${formatAve(stats.combinedAve)} in AVE. "${spotlight.title}" is the standout ${ws.adMode ? 'spot' : 'story'}. Recommend monitoring the ${ws.trending[0]?.entities[0] ?? 'leading'} cluster for a follow-up spike within 24 hours.`
    : '';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader
                onClose={() => router.back()}
                title={`Today's brief${category ? ` · ${category}` : ''}`}
                rightActions={
                  <Pressable onPress={() => setAiState('idle')} accessibilityRole="button" accessibilityLabel="Regenerate brief" hitSlop={8} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
                    <Ionicons name="refresh" size={20} color={theme.text} />
                  </Pressable>
                }
              />
            </View>
          </GestureDetector>

          <View style={styles.tabRow}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.tabActive]}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              onScrollTop(e);
              dismiss.onScroll(e);
            }}
            scrollEventThrottle={16}>
            {articles.length === 0 ? (
              <Text style={styles.emptyText}>No coverage in this category today.</Text>
            ) : (
              <View style={styles.bodyContent}>
                {tab === 'spotlight' && (
                  <>
                    <View style={styles.statsRow}>
                      <Tile dark={false} value={stats.topOutlet} label="top source" />
                      <Tile dark value={formatAve(stats.combinedAve)} label="combined AVE" />
                      <Tile dark value={`${stats.sentimentSplit[stats.dominantSentiment]}%`} label={`${stats.dominantSentiment}`} />
                    </View>

                    {spotlight && (
                      <View style={styles.shCard}>
                        <View style={styles.shBadge}>
                          <Ionicons name="flame" size={11} color={lilac} />
                          <Text style={[styles.shBadgeText, { color: lilac }]}>{ws.spotlightTier ? 'Tier 1 Spotlight' : 'Featured Spotlight'}</Text>
                        </View>
                        <Text style={styles.shHeadline}>{spotlight.title}</Text>
                        <Text style={styles.shMeta} numberOfLines={1}>
                          {spotlight.outlet} · {spotlight.section} · {spotlight.ago} ·{' '}
                          <Text style={styles.shMetaStrong}>{formatAve(spotlight.ave)}</Text>
                        </Text>
                        <View style={styles.shChipRow}>
                          <SentimentPill sentiment={spotlight.sentiment} />
                          <View style={[styles.shChip, styles.shChipVelocity]}>
                            <Ionicons name="flame" size={11} color={lilac} />
                            <Text style={[styles.shChipText, { color: lilac }]}>SV {spotlight.storyValue.toFixed(1)}</Text>
                          </View>
                        </View>
                        <View style={styles.shActions}>
                          <Action icon="mail-outline" label="Send as newsletter" onPress={sendNewsletter} />
                          <Action icon="document-text-outline" label="Generate AI report" onPress={generateReport} />
                          <Action
                            icon={isSaved(spotlight.url) ? 'checkmark' : 'megaphone-outline'}
                            label={isSaved(spotlight.url) ? 'Tracking' : 'Track this story'}
                            active={isSaved(spotlight.url)}
                            onPress={() => toggleSave(spotlight.url)}
                          />
                          <Action icon="share-outline" label="Export" onPress={exportBrief} />
                        </View>
                      </View>
                    )}

                    {aiState !== 'idle' && (
                      <View style={styles.aiCard}>
                        <Text style={aiState === 'done' ? styles.aiText : styles.aiHint}>
                          {aiState === 'done' ? aiText : 'Analyzing today’s coverage…'}
                        </Text>
                      </View>
                    )}

                    {spotlight && <ArticleCard article={spotlight} matchScore={matchScore(spotlight)} />}

                    {coverage.length > 0 && (
                      <>
                        <Text style={styles.sectionLabel}>
                          All coverage — {coverage.length} {coverage.length === 1 ? ws.noun : ws.nouns}
                        </Text>
                        <View style={styles.coverList}>
                          {coverage.map((a) => (
                            <ArticleCard key={a.id} article={a} matchScore={matchScore(a)} />
                          ))}
                        </View>
                      </>
                    )}
                  </>
                )}

                {tab === 'trending' && (
                  <View style={styles.trendList}>
                    {resolvedStories.map((story) => {
                      const open = expanded.has(story.rank);
                      return (
                        <View key={story.rank} style={styles.trendStory}>
                          <Pressable onPress={() => toggleStory(story.rank)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={({ pressed }) => [styles.trendHeader, pressed && styles.pressed]}>
                            <Text style={styles.trendRank}>#{story.rank}</Text>
                            <View style={styles.trendMain}>
                              <Text style={styles.trendTitle}>{story.title}</Text>
                              <View style={styles.trendMeta}>
                                <Text style={styles.trendTier}>{story.tier}</Text>
                                <Text style={styles.trendDot}>·</Text>
                                <Text style={styles.trendMetaText}>
                                  {story.members.length} {story.members.length === 1 ? ws.noun : ws.nouns}
                                </Text>
                                <Text style={styles.trendDot}>·</Text>
                                <Text style={styles.trendValue}>{formatAve(story.members.reduce((s, m) => s + m.ave, 0))}</Text>
                              </View>
                            </View>
                            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
                          </Pressable>
                          {open && (
                            <View style={styles.trendBody}>
                              <View style={styles.trendWhy}>
                                <Ionicons name="flash-outline" size={13} color={lilac} />
                                <Text style={styles.trendWhyText}>
                                  <Text style={styles.trendWhyLabel}>Why picked: </Text>
                                  {story.why}
                                </Text>
                              </View>
                              {story.members.map((a) => (
                                <ArticleCard key={a.id} article={a} matchScore={matchScore(a)} />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <BackToTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
      </SafeAreaView>
    </View>
  );
}

function Tile({ value, label, dark }: { value: string; label: string; dark: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.tile, dark ? styles.tileDark : styles.tileLight]}>
      <Text style={[styles.tileValue, dark && styles.tileValueLight]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.tileLabel, dark && styles.tileLabelLight]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Action({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.shAction, active && styles.shActionActive, pressed && styles.pressed]}>
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : theme.text} />
      <Text style={[styles.shActionText, active && styles.shActionTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, backgroundColor: t.background, borderBottomWidth: 1, borderBottomColor: t.borderCool },
  tab: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999 },
  // Active tab — near-black fill with white text in both schemes (no inverse-button token); kept literal.
  tabActive: { backgroundColor: t.inverse },
  tabText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
  tabTextActive: { color: '#FFFFFF' },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.three, gap: Spacing.three },
  statsRow: { flexDirection: 'row', gap: Spacing.two + 2 },
  tile: { flex: 1, minWidth: 0, borderRadius: 12, paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.two + 4, gap: 4, justifyContent: 'space-between' },
  tileLight: { backgroundColor: t.topicBg },
  // Intentionally-dark navy stat tile — kept literal across schemes (spec).
  tileDark: { backgroundColor: '#1A1A35' },
  tileValue: { fontSize: 14, fontWeight: '700', color: t.text },
  tileValueLight: { color: '#FFFFFF' },
  tileLabel: { fontSize: 10, color: t.textSecondary },
  tileLabelLight: { color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: Spacing.two },
  coverList: { gap: Spacing.five },
  shCard: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorderCool, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  // Lilac keyword tint badge — kept literal (spec); the label color is set scheme-aware inline.
  shBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: 'rgba(185, 164, 247, 0.18)', borderWidth: 1, borderColor: 'rgba(185, 164, 247, 0.35)', borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: 3 },
  shBadgeText: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  shHeadline: { fontSize: 17, fontWeight: '700', color: t.text, letterSpacing: -0.2, lineHeight: 23 },
  shMeta: { fontSize: 12, color: t.textSecondary },
  shMetaStrong: { color: t.positive, fontWeight: '700' },
  shChipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.one + 2 },
  shChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.elevated, borderRadius: 999, paddingHorizontal: Spacing.two + 2, paddingVertical: 4 },
  // Lilac keyword tint — kept literal (spec); text color is set scheme-aware inline.
  shChipVelocity: { backgroundColor: 'rgba(185, 164, 247, 0.15)' },
  shChipText: { fontSize: 12, fontWeight: '600', color: t.text },
  shActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  shAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexGrow: 1, flexBasis: '46%', borderWidth: 1, borderColor: t.borderCool, borderRadius: 12, paddingVertical: Spacing.two + 2, backgroundColor: t.card },
  // Active ("Tracking") action — near-black fill with white text in both schemes (no inverse-button token); kept literal.
  shActionActive: { backgroundColor: t.inverse, borderColor: t.inverse },
  shActionText: { fontSize: 13, fontWeight: '600', color: t.text },
  shActionTextActive: { color: '#FFFFFF' },
  aiCard: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorderCool, borderRadius: 16, padding: Spacing.three },
  aiHint: { fontSize: 13, color: t.textSecondary, lineHeight: 19 },
  aiText: { fontSize: 14, lineHeight: 21, color: t.text },
  trendList: { gap: Spacing.three },
  trendStory: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorderCool, borderRadius: 14, overflow: 'hidden' },
  trendHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, padding: Spacing.three },
  trendRank: { fontSize: 14, fontWeight: '700', color: t.textSecondary, marginTop: 1 },
  trendMain: { flex: 1, gap: 6 },
  trendTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20, color: t.text },
  trendMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  trendTier: { fontSize: 12, fontWeight: '700', color: t.text },
  trendDot: { fontSize: 12, color: t.borderCool },
  trendMetaText: { fontSize: 12, color: t.textSecondary },
  trendValue: { fontSize: 12, fontWeight: '700', color: t.positive },
  trendBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.four, borderTopWidth: 1, borderTopColor: t.borderCool },
  // Lilac keyword tint — kept literal (spec).
  trendWhy: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(185, 164, 247, 0.12)', borderRadius: 10, padding: Spacing.two },
  trendWhyText: { flex: 1, fontSize: 12, lineHeight: 17, color: t.textSecondary },
  trendWhyLabel: { fontWeight: '700', color: t.text },
  emptyText: { textAlign: 'center', color: t.textSecondary, paddingTop: Spacing.six },
  pressed: { opacity: 0.6 },
});
