import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { MediaWatchBrief } from '@/components/mediawatch/brief-body';
import { MentionCard } from '@/components/mention-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import {
  BriefStatTiles,
  PLATFORM_LABEL,
  deriveBriefStats,
  formatCompact,
  rankByEngagement,
  totalEngagement,
} from '@/components/todays-brief-card';
import { Spacing, Theme } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { isArticleView } from '@/data/article-workspace';
import { socialMentions, trendingStories } from '@/data/sample-data';
import { bucketsForCategory, CATEGORY_TAXONOMY } from '@/data/taxonomy';
import { Sentiment, SocialMention } from '@/data/types';

const TABS = [
  { key: 'spotlight', label: 'Spotlight' },
  { key: 'trending', label: 'Trending' },
] as const;

// Web spotlight-header chip colors (Neutral / Positive / Negative pills).
const SENTIMENT_CHIP: Record<Sentiment, { bg: string; text: string }> = {
  positive: { bg: 'rgba(22, 163, 74, 0.12)', text: '#166534' },
  neutral: { bg: '#F0F0F0', text: '#374151' },
  negative: { bg: 'rgba(233, 79, 55, 0.12)', text: '#B0463C' },
};

type TabKey = (typeof TABS)[number]['key'];

const TRENDING_PAGE_LIMIT = 5;
// Matches the web brief's doGenerate() simulated latency.
const AI_GENERATE_DELAY_MS = 900;

// Parse an estimated-reach string ("84K", "1.2M", "6.2K") to a number, and
// format a summed cluster total the same way (social model → reach, not AVE).
function parseReach(s?: string): number {
  if (!s) return 0;
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KM]?)/i);
  if (!m) return 0;
  let n = parseFloat(m[1]) || 0;
  const u = (m[2] || '').toUpperCase();
  if (u === 'K') n *= 1e3;
  else if (u === 'M') n *= 1e6;
  return n;
}
function formatReach(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return `${Math.round(n)}`;
}
// Dominant sentiment across a cluster (ties → negative › neutral › positive).
function dominantSentiment(members: SocialMention[]): Sentiment {
  const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  members.forEach((m) => {
    counts[m.sentiment] += 1;
  });
  let best: Sentiment = 'neutral';
  let bestCount = -1;
  (['negative', 'neutral', 'positive'] as Sentiment[]).forEach((s) => {
    if (counts[s] > bestCount) {
      best = s;
      bestCount = counts[s];
    }
  });
  return best;
}

// Route dispatcher: the article workspaces (MediaWatch news, AdWatch ads) show
// the shared article brief; others keep the SharedView social brief below.
export default function BriefRoute() {
  const { activeView } = useAuth();
  return isArticleView(activeView) ? <MediaWatchBrief /> : <SharedViewBrief />;
}

function SharedViewBrief() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  // The lilac "Trending Spotlight"/velocity labels are too dark to read on the
  // charcoal canvas — swap to the lightened variant in dark.
  const lilac = isDark ? '#A78BFA' : '#6B4DE8';
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('spotlight');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done'>('idle');
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { hideProgress } = useTabBarVisibility();
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const dismiss = useDismissGesture(() => router.back());

  // Slide the bottom tab bar away while this page is focused (same shared
  // value the feed's scroll-hide uses), and bring it back on exit.
  useFocusEffect(
    useCallback(() => {
      Animated.timing(hideProgress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      return () => {
        Animated.timing(hideProgress, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      };
    }, [hideProgress]),
  );

  useEffect(() => {
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
    };
  }, []);

  const mentions = useMemo(() => {
    if (!category) return socialMentions;
    const categoryBuckets = new Set(bucketsForCategory(category));
    return socialMentions.filter((m) => m.entities.some((e) => categoryBuckets.has(e)));
  }, [category]);

  const stats = useMemo(() => deriveBriefStats(mentions), [mentions]);
  const topPosts = useMemo(() => rankByEngagement(mentions).slice(0, TRENDING_PAGE_LIMIT), [mentions]);
  const spotlight = topPosts[0];
  const { isSaved, toggleSave } = useBookmarks();

  // Trending tab: ranked story clusters whose members, count, value and
  // sentiment are resolved from the scoped mentions. Stories with no in-scope
  // members are dropped (e.g. when a narrower category is selected).
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());
  function toggleStory(rank: number) {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  }
  const resolvedStories = useMemo(
    () =>
      trendingStories
        .map((story) => {
          const members = mentions.filter((m) =>
            m.entities.some((e) => story.entities.includes(e)),
          );
          return {
            ...story,
            members,
            postCount: members.length,
            reach: formatReach(members.reduce((sum, m) => sum + parseReach(m.estReach), 0)),
            sentiment: dominantSentiment(members),
          };
        })
        .filter((s) => s.members.length > 0),
    [mentions],
  );

  // Web-parity MATCH column. The web client ships hardcoded percentages; here
  // the score is derived — the share of a post's tagged entities inside the
  // scoped category's buckets, scaled to the 60–98 band the web displays.
  const relevantBuckets = useMemo(
    () =>
      new Set(
        category
          ? bucketsForCategory(category)
          : CATEGORY_TAXONOMY.flatMap((c) => c.buckets.map((b) => b.name)),
      ),
    [category],
  );

  function matchScoreFor(mention: SocialMention): number {
    if (mention.entities.length === 0) return 60;
    const overlap =
      mention.entities.filter((e) => relevantBuckets.has(e)).length / mention.entities.length;
    return Math.round(60 + 38 * overlap);
  }

  // Web's "All coverage" list: everything in scope minus the spotlight hero
  // (which has its own card), most-relevant first — match desc with
  // engagement tiebreak, mirroring the web's default "Sort: Similarity".
  const coverage = useMemo(
    () =>
      mentions
        .filter((m) => m.url !== spotlight?.url)
        .sort(
          (a, b) => matchScoreFor(b) - matchScoreFor(a) || totalEngagement(b) - totalEngagement(a),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentions, spotlight, relevantBuckets],
  );

  function generateAnalysis() {
    if (aiState === 'loading') return;
    setAiState('loading');
    aiTimer.current = setTimeout(() => setAiState('done'), AI_GENERATE_DELAY_MS);
  }

  // Spotlight-header actions — the web's four buttons, mapped to native
  // capabilities: mailto (newsletter), the AI tab (report), bookmarks
  // (tracker), and the OS share sheet (export).
  const briefSummary = spotlight
    ? `Today's brief${category ? ` — ${category}` : ''}: ${stats.trendingEntity ?? 'Top story'} leads with ${formatCompact(totalEngagement(spotlight))} engagement.\n\n${spotlight.post}\n\n${spotlight.url}`
    : '';

  function sendNewsletter() {
    const subject = encodeURIComponent(`Today's brief${category ? ` — ${category}` : ''}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${encodeURIComponent(briefSummary)}`);
  }

  // The AI-analysis tab is gone; "Generate AI report" now reveals the Smart
  // Brief synthesis inline in the Spotlight tab instead of switching tabs.
  function generateReport() {
    generateAnalysis();
  }

  function exportBrief() {
    Share.share({ message: briefSummary }).catch(() => {});
  }

  // Trending story-level actions: Track bookmarks all member posts (toggle all
  // off when already fully tracked); Export shares the cluster summary + links.
  function toggleStoryTrack(members: SocialMention[]) {
    const allTracked = members.length > 0 && members.every((m) => isSaved(m.url));
    members.forEach((m) => {
      if (allTracked || !isSaved(m.url)) toggleSave(m.url);
    });
  }
  function exportStory(story: {
    title: string;
    tier: string;
    postCount: number;
    reach: string;
    members: SocialMention[];
  }) {
    const links = story.members.map((m) => m.url).join('\n');
    const message = `${story.title}\n${story.tier} · ${story.postCount} posts · ${story.reach} reach\n\n${links}`;
    Share.share({ message }).catch(() => {});
  }

  // Simulated Smart Brief output (the web app's doGenerate() equivalent) —
  // templated from the derived stats rather than a backend.
  const aiText = spotlight
    ? `Today's conversation is led by ${PLATFORM_LABEL[stats.topPlatform]} and skews ${stats.dominantSentiment} (${stats.dominantPct}% of tracked posts). ` +
      `${stats.trendingEntity ?? 'The top story'} is the standout topic — engagement on the top ${stats.trending.length} posts outpaces the rest of the feed, with ${spotlight.handle} driving the single largest thread. ` +
      `Owner experiences and delivery timelines dominate the discussion, while competitor chatter stays comparatively muted. ` +
      `Recommend monitoring the ${stats.trendingEntity ?? 'leading'} conversation for a follow-up spike within the next 24 hours.`
    : '';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <Animated.View style={[styles.fill, dismiss.style]}>
        {/* Fixed header + a static tab bar below it: the tabs stay put while
            the content scrolls. The tab row is a plain flexDirection:'row' View,
            NOT a ScrollView sticky header — the native sticky-header wrapper
            collapses the row into a vertical stack (renders fine on web). */}
        <GestureDetector gesture={dismiss.gesture}>
          <View>
            <SheetHeader
              onClose={() => router.back()}
              title={`Today's brief${category ? ` · ${category}` : ''}`}
              rightActions={
                <Pressable
                  onPress={() => {
                    setRefreshNonce((n) => n + 1);
                    setAiState('idle');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Regenerate brief"
                  hitSlop={8}
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
                  <Ionicons name="refresh" size={20} color={theme.text} />
                </Pressable>
              }
            />
          </View>
        </GestureDetector>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
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
        {mentions.length === 0 ? (
          <Text style={styles.emptyText}>No mentions in this category today.</Text>
        ) : (
          <View style={styles.bodyContent}>
            {activeTab === 'spotlight' && (
              <>
                <BriefStatTiles stats={stats} total={mentions.length} nonce={refreshNonce} />
                {spotlight && (
                  <View style={styles.shCard}>
                    <View style={styles.shBadge}>
                      <Ionicons name="flame" size={11} color={lilac} />
                      <Text style={[styles.shBadgeText, { color: lilac }]}>Trending Spotlight</Text>
                    </View>
                    <Text style={styles.shHeadline}>
                      {stats.trendingEntity ?? spotlight.handle} leads today&apos;s conversation
                    </Text>
                    <Text style={styles.shMeta} numberOfLines={1}>
                      {PLATFORM_LABEL[spotlight.platform]} · {category ?? 'All categories'} ·{' '}
                      {spotlight.ago} ·{' '}
                      <Text style={styles.shMetaStrong}>
                        {formatCompact(totalEngagement(spotlight))} total
                      </Text>
                    </Text>
                    <View style={styles.shChipRow}>
                      <View
                        style={[styles.shChip, { backgroundColor: SENTIMENT_CHIP[spotlight.sentiment].bg }]}>
                        <Text
                          style={[styles.shChipText, { color: SENTIMENT_CHIP[spotlight.sentiment].text }]}>
                          {spotlight.sentiment.charAt(0).toUpperCase() + spotlight.sentiment.slice(1)}
                        </Text>
                      </View>
                      <View style={[styles.shChip, styles.shChipVelocity]}>
                        <Ionicons name="flame" size={11} color={lilac} />
                        <Text style={[styles.shChipText, { color: lilac }]}>
                          {stats.trending.length} posts / today
                        </Text>
                      </View>
                      {[...new Set(stats.trending.map((m) => m.platform))].map((platform) => (
                        <View key={platform} style={styles.shChip}>
                          <Text style={styles.shChipText}>{PLATFORM_LABEL[platform]}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.shActions}>
                      <Pressable
                        onPress={sendNewsletter}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.shAction, pressed && styles.pressed]}>
                        <Ionicons name="mail-outline" size={15} color={theme.text} />
                        <Text style={styles.shActionText}>Send as newsletter</Text>
                      </Pressable>
                      <Pressable
                        onPress={generateReport}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.shAction, pressed && styles.pressed]}>
                        <Ionicons name="document-text-outline" size={15} color={theme.text} />
                        <Text style={styles.shActionText}>Generate AI report</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => toggleSave(spotlight.url)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSaved(spotlight.url) }}
                        style={({ pressed }) => [
                          styles.shAction,
                          isSaved(spotlight.url) && styles.shActionActive,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name={isSaved(spotlight.url) ? 'checkmark' : 'megaphone-outline'}
                          size={15}
                          color={isSaved(spotlight.url) ? '#FFFFFF' : theme.text}
                        />
                        <Text
                          style={[
                            styles.shActionText,
                            isSaved(spotlight.url) && styles.shActionTextActive,
                          ]}>
                          {isSaved(spotlight.url) ? 'Tracking' : 'Track this story'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={exportBrief}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.shAction, pressed && styles.pressed]}>
                        <Ionicons name="share-outline" size={15} color={theme.text} />
                        <Text style={styles.shActionText}>Export</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                {aiState !== 'idle' && (
                  <View style={styles.aiCard}>
                    {aiState === 'done' ? (
                      <Text style={styles.aiText}>{aiText}</Text>
                    ) : (
                      <Text style={styles.aiHint}>Analyzing today&apos;s coverage…</Text>
                    )}
                  </View>
                )}
                {spotlight && (
                  <MentionCard
                    mention={spotlight}
                    saved={isSaved(spotlight.url)}
                    onToggleSave={() => toggleSave(spotlight.url)}
                    matchScore={matchScoreFor(spotlight)}
                  />
                )}
                {coverage.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>
                      All coverage — {coverage.length} {coverage.length === 1 ? 'post' : 'posts'}
                    </Text>
                    {coverage.map((mention) => (
                      <MentionCard
                        key={mention.url}
                        mention={mention}
                        saved={isSaved(mention.url)}
                        onToggleSave={() => toggleSave(mention.url)}
                        matchScore={matchScoreFor(mention)}
                      />
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'trending' && (
              <View style={styles.trendList}>
                {resolvedStories.map((story) => {
                  const open = expandedStories.has(story.rank);
                  const chip = SENTIMENT_CHIP[story.sentiment];
                  const storyTracked =
                    story.members.length > 0 && story.members.every((m) => isSaved(m.url));
                  return (
                    <View key={story.rank} style={styles.trendStory}>
                      <Pressable
                        onPress={() => toggleStory(story.rank)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        style={({ pressed }) => [styles.trendHeader, pressed && styles.pressed]}>
                        <Text style={styles.trendRank}>#{story.rank}</Text>
                        <View style={styles.trendMain}>
                          <Text style={styles.trendTitle}>{story.title}</Text>
                          <View style={styles.trendMeta}>
                            <Text style={styles.trendTier}>{story.tier}</Text>
                            <View style={[styles.trendSentChip, { backgroundColor: chip.bg }]}>
                              <Text style={[styles.trendSentText, { color: chip.text }]}>
                                {story.sentiment.charAt(0).toUpperCase() + story.sentiment.slice(1)}
                              </Text>
                            </View>
                            <Text style={styles.trendDot}>·</Text>
                            <Text style={styles.trendMetaText}>
                              {story.postCount} {story.postCount === 1 ? 'post' : 'posts'}
                            </Text>
                            <Text style={styles.trendDot}>·</Text>
                            <Text style={styles.trendValue}>{story.reach} reach</Text>
                          </View>
                        </View>
                        <Ionicons
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </Pressable>

                      {open && (
                        <>
                          <View style={styles.trendActions}>
                            <Pressable
                              onPress={() => toggleStoryTrack(story.members)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: storyTracked }}
                              style={({ pressed }) => [
                                styles.shAction,
                                storyTracked && styles.shActionActive,
                                pressed && styles.pressed,
                              ]}>
                              <Ionicons
                                name={storyTracked ? 'checkmark' : 'megaphone-outline'}
                                size={15}
                                color={storyTracked ? '#FFFFFF' : theme.text}
                              />
                              <Text
                                style={[styles.shActionText, storyTracked && styles.shActionTextActive]}>
                                {storyTracked ? 'Tracking' : 'Track this story'}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => exportStory(story)}
                              accessibilityRole="button"
                              accessibilityLabel="Export story"
                              style={({ pressed }) => [styles.shAction, pressed && styles.pressed]}>
                              <Ionicons name="download-outline" size={15} color={theme.text} />
                              <Text style={styles.shActionText}>Export</Text>
                            </Pressable>
                          </View>

                          <View style={styles.trendBody}>
                            <View style={styles.trendWhy}>
                              <Ionicons name="flash-outline" size={13} color={lilac} />
                              <Text style={styles.trendWhyText}>
                                <Text style={styles.trendWhyLabel}>Why picked: </Text>
                                {story.why}
                              </Text>
                            </View>
                            {story.members.map((mention) => (
                              <MentionCard
                                key={mention.url}
                                mention={mention}
                                saved={isSaved(mention.url)}
                                onToggleSave={() => toggleSave(mention.url)}
                                matchScore={matchScoreFor(mention)}
                              />
                            ))}
                          </View>
                        </>
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

        <BackToTop
          visible={showTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </SafeAreaView>
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
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: t.card,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: t.text,
    letterSpacing: -0.2,
  },
  // Static tab bar below the header: solid background + hairline to divide it
  // from the scrolling content beneath.
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    backgroundColor: t.background,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  tab: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: t.inverse,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.two,
  },

  // Trending tab — ranked, expandable story clusters
  trendList: {
    gap: Spacing.three,
  },
  trendStory: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 14,
    overflow: 'hidden',
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  trendRank: {
    fontSize: 14,
    fontWeight: '700',
    color: t.textSecondary,
    marginTop: 1,
  },
  trendMain: {
    flex: 1,
    gap: 6,
  },
  trendTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: t.text,
  },
  trendMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  trendTier: {
    fontSize: 12,
    fontWeight: '700',
    color: t.text,
  },
  trendSentChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trendSentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  trendDot: {
    fontSize: 12,
    color: t.borderCool,
  },
  trendMetaText: {
    fontSize: 12,
    color: t.textSecondary,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '700',
    color: t.positive,
  },
  trendBody: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: t.borderCool,
  },
  trendActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  trendWhy: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(185, 164, 247, 0.12)',
    borderRadius: 10,
    padding: Spacing.two,
  },
  trendWhyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: t.textSecondary,
  },
  trendWhyLabel: {
    fontWeight: '700',
    color: t.text,
  },
  shCard: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  shBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(185, 164, 247, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(185, 164, 247, 0.35)',
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 3,
  },
  shBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B4DE8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: t.text,
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  shMeta: {
    fontSize: 12,
    color: t.textSecondary,
  },
  shMetaStrong: {
    color: t.positive,
    fontWeight: '700',
  },
  shChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  shChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: t.topicBg,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
  },
  shChipVelocity: {
    backgroundColor: 'rgba(185, 164, 247, 0.15)',
  },
  shChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.text,
  },
  shActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  shAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 12,
    paddingVertical: Spacing.two + 2,
    backgroundColor: t.card,
  },
  shActionActive: {
    backgroundColor: t.inverse,
    borderColor: t.inverse,
  },
  shActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  shActionTextActive: {
    color: '#FFFFFF',
  },
  aiCard: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 16,
    padding: Spacing.three,
  },
  aiHint: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.three,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: t.inverse,
    borderRadius: 999,
    paddingVertical: Spacing.two + 2,
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiText: {
    fontSize: 14,
    lineHeight: 21,
    color: t.text,
  },
  emptyText: {
    textAlign: 'center',
    color: t.textSecondary,
    paddingTop: Spacing.six,
  },
  pressed: {
    opacity: 0.6,
  },
});
