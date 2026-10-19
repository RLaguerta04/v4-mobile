// MediaWatch Activity Tracker detail — the article-native counterpart of
// activity-detail-modal.tsx. Reuses the article-native tracker math
// (buildTimeline / formatPhp) and ArticleCard, so SharedView's social detail
// stays untouched. Matched coverage is the activity's own matches, resolved to
// full NewsArticles where possible for tap-through.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { adwatchAds } from '@/data/adwatch-ads';
import { newsArticles } from '@/data/mediawatch-articles';
import { ArticleKeyword, computeArticleKeywords } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';
import type { TrackerMedia } from '@/data/types';
import { buildTimeline, formatPhp, ResolvedActivity, TimelineStage } from '@/utils/metrics';

type IoniconName = keyof typeof Ionicons.glyphMap;
type TabKey = 'matches' | 'timeline' | 'keywords';

const DETAIL_TABS: { key: TabKey; label: string; icon: IoniconName }[] = [
  { key: 'matches', label: 'Matched articles', icon: 'list-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'git-commit-outline' },
  { key: 'keywords', label: 'Keyword Cloud', icon: 'cloud-outline' },
];

const MEDIA_ICON: Record<TrackerMedia, IoniconName> = {
  Online: 'globe-outline',
  TV: 'tv-outline',
  Print: 'newspaper-outline',
  Radio: 'radio-outline',
};
const TL_ICON: Record<TimelineStage['kind'], IoniconName> = {
  start: 'megaphone-outline',
  agg: 'git-network-outline',
  media: 'ellipse',
  total: 'trending-up',
};

const KW_PALETTE = ['#6B5CB8', '#D946EF', '#F97316', '#0EA5E9', '#14B8A6', '#16A34A', '#EC4899'];

function resolveArticle(title: string): NewsArticle | undefined {
  // Titles are unique across the two article workspaces, so a tracked match
  // resolves from whichever dataset carries it (MediaWatch news or AdWatch ads).
  return newsArticles.find((a) => a.title === title) ?? adwatchAds.find((a) => a.title === title);
}

function buildSummary(activity: ResolvedActivity): { gist: string; read: string } {
  const matches = activity.matches;
  const outlets = [...new Set(matches.map((m) => m.source))];
  const channels = [...new Set(matches.map((m) => m.media))];
  const total = matches.reduce((s, m) => s + m.value, 0);
  const gist = `"${activity.title}" drew ${matches.length} matched ${
    matches.length === 1 ? 'article' : 'articles'
  } across ${channels.length} ${channels.length === 1 ? 'channel' : 'channels'}, generating ${formatPhp(total)} in AVE.`;
  const read = matches.length
    ? `Coverage is led by ${outlets.slice(0, 3).join(', ')}${outlets.length > 3 ? ' and others' : ''}. The highest-value pickup is "${
        [...matches].sort((a, b) => b.value - a.value)[0].title
      }" (${formatPhp([...matches].sort((a, b) => b.value - a.value)[0].value)} AVE).`
    : 'No coverage has been matched to this activity yet — it fills in as articles are found.';
  return { gist, read };
}

export function ArticleActivityDetailModal({
  activity,
  onClose,
}: {
  activity: ResolvedActivity | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const accentColor = useAccentColor();
  const [tab, setTab] = useState<TabKey>('matches');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{ gist: string; read: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop, reset: resetTop } = useScrollToTop();

  useEffect(() => {
    if (activity) resetTop();
  }, [activity, resetTop]);

  const dismiss = useDismissGesture(handleClose);

  const matchedArticles = activity
    ? activity.matches.map((m) => resolveArticle(m.title)).filter((a): a is NewsArticle => !!a)
    : [];

  function handleClose() {
    setTab('matches');
    setSummaryOpen(false);
    setSummaryLoading(false);
    setSummary(null);
    onClose();
  }
  function runSummary() {
    if (!activity) return;
    const a = activity;
    setSummary(null);
    setSummaryLoading(true);
    setTimeout(() => {
      setSummary(buildSummary(a));
      setSummaryLoading(false);
    }, 1100);
  }
  function openSummary() {
    setSummaryOpen(true);
    if (!summary && !summaryLoading) runSummary();
  }
  function exportActivity() {
    if (!activity) return;
    const lines = activity.matches.map((m) => `• ${m.source}: ${m.title} (${formatPhp(m.value)})`).join('\n');
    Share.share({ message: `${activity.title}\n${activity.type} · ${activity.matchCount} matched articles\n\n${lines}` }).catch(() => {});
  }

  return (
    <Modal visible={activity !== null} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={handleClose} title="Activity" />
            </View>
          </GestureDetector>

          {activity && (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                onScrollTop(e);
                dismiss.onScroll(e);
              }}
              scrollEventThrottle={16}
              stickyHeaderIndices={[2]}>
              <View style={styles.card}>
                <Text style={styles.activityType}>
                  {activity.type} · {activity.date}
                </Text>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityDesc}>{activity.description}</Text>
              </View>

              <View style={styles.kpiRow}>
                <View style={[styles.kpiCard, styles.kpiPurple]}>
                  <Text style={styles.kpiValue}>{activity.matchCount}</Text>
                  <Text style={styles.kpiLabel}>AI matches</Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiGreen]}>
                  <Text style={styles.kpiValue}>{activity.avgMatch}%</Text>
                  <Text style={styles.kpiLabel}>avg similarity</Text>
                </View>
                <View style={[styles.kpiCard, styles.kpiDark]}>
                  <Text style={styles.kpiValue}>{activity.value}</Text>
                  <Text style={styles.kpiLabel}>total AVE</Text>
                </View>
              </View>

              <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
                  {DETAIL_TABS.map((t) => {
                    const on = tab === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setTab(t.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={[styles.tab, on && styles.tabActive]}>
                        <Ionicons name={t.icon} size={15} color={on ? theme.text : theme.textSecondary} />
                        <Text style={[styles.tabText, on && styles.tabTextActive]}>
                          {t.label}
                          {t.key === 'matches' ? ` (${activity.matchCount})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {tab === 'matches' && (
                <>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={openSummary}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.action, summaryOpen && styles.actionActive, pressed && styles.pressed]}>
                      <Ionicons name="sparkles-outline" size={15} color={summaryOpen ? accentColor : theme.text} />
                      <Text style={[styles.actionText, summaryOpen && { color: accentColor }]}>AI summary</Text>
                    </Pressable>
                    <Pressable
                      onPress={exportActivity}
                      accessibilityRole="button"
                      accessibilityLabel="Export activity"
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                      <Ionicons name="download-outline" size={15} color={theme.text} />
                      <Text style={styles.actionText}>Export</Text>
                    </Pressable>
                  </View>

                  {summaryOpen && (
                    <View style={styles.summaryPanel}>
                      <View style={styles.summaryHeader}>
                        <View style={styles.summaryLabel}>
                          <Ionicons name="sparkles" size={13} color={accentColor} />
                          <Text style={styles.summaryLabelText}>AI Summary</Text>
                        </View>
                        <Pressable onPress={() => setSummaryOpen(false)} accessibilityRole="button" accessibilityLabel="Hide summary" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                          <Ionicons name="close" size={16} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                      {summaryLoading || !summary ? (
                        <View style={styles.summaryLoadingRow}>
                          <ActivityIndicator size="small" color={accentColor} />
                          <Text style={styles.summaryLoadingText}>Reading the matched coverage…</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.summarySub}>Overview</Text>
                          <Text style={styles.summaryText}>{summary.gist}</Text>
                          <Text style={styles.summarySub}>What the coverage says</Text>
                          <Text style={styles.summaryText}>{summary.read}</Text>
                        </>
                      )}
                    </View>
                  )}

                  {activity.matches.length === 0 ? (
                    <Text style={styles.empty}>No matched articles yet.</Text>
                  ) : (
                    <View style={styles.covList}>
                      {activity.matches.map((m, i) => {
                        const resolved = resolveArticle(m.title);
                        if (resolved) {
                          return <ArticleCard key={resolved.id} article={resolved} matchScore={Math.round(m.score * 100)} />;
                        }
                        return (
                          <View key={`${m.title}-${i}`} style={styles.matchRow}>
                            <Text style={styles.matchOutlet}>{m.source}</Text>
                            <Text style={styles.matchTitle} numberOfLines={2}>
                              {m.title}
                            </Text>
                            <Text style={styles.matchMeta}>
                              {m.media} · {m.date} · {formatPhp(m.value)} AVE · {Math.round(m.score * 100)}% match
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {tab === 'timeline' && <Timeline activity={activity} />}
              {tab === 'keywords' && <KeywordCloud articles={matchedArticles} />}
            </ScrollView>
          )}
        </Animated.View>

        {activity && (
          <BackToTop visible={showTop} anchor="safe" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Timeline({ activity }: { activity: ResolvedActivity }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const stages = buildTimeline(activity);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <View style={styles.timeline}>
      {stages.map((stage, i) => {
        const icon = stage.kind === 'media' && stage.media ? MEDIA_ICON[stage.media] : TL_ICON[stage.kind];
        const open = expanded.has(stage.key);
        const expandable = !!(stage.posts && stage.posts.length);
        return (
          <View key={stage.key} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlNode, stage.kind === 'total' && styles.tlNodeAccent]}>
                <Ionicons name={icon} size={13} color={stage.kind === 'total' ? '#FFFFFF' : theme.text} />
              </View>
              {i < stages.length - 1 && <View style={styles.tlLine} />}
            </View>
            <View style={styles.tlCardWrap}>
              <Pressable
                disabled={!expandable}
                onPress={() => toggle(stage.key)}
                style={({ pressed }) => [styles.tlCard, pressed && expandable && styles.pressed]}>
                <View style={styles.tlCardMain}>
                  <Text style={styles.tlTitle}>{stage.title}</Text>
                  {stage.sub && <Text style={styles.tlSub}>{stage.sub}</Text>}
                  {stage.meta && <Text style={styles.tlMeta}>{stage.meta}</Text>}
                </View>
                {expandable && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />}
              </Pressable>
              {open && expandable && (
                <View style={styles.tlPosts}>
                  {stage.posts!.map((m, j) => (
                    <View key={j} style={styles.tlPost}>
                      <Text style={styles.tlPostHandle}>{m.source}</Text>
                      <Text style={styles.tlPostText} numberOfLines={2}>
                        {m.title}
                      </Text>
                      <Text style={styles.tlPostMeta}>
                        {m.date} · {formatPhp(m.value)} AVE
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function KeywordCloud({ articles }: { articles: NewsArticle[] }) {
  const styles = useThemedStyles(makeStyles);
  const keywords = computeArticleKeywords(articles);
  const [coverageKw, setCoverageKw] = useState<ArticleKeyword | null>(null);
  if (!keywords.length) {
    return <Text style={styles.empty}>No keywords for this activity.</Text>;
  }
  const max = keywords[0].count;
  const min = keywords[keywords.length - 1].count;
  const colorOf = (t: string) => KW_PALETTE[Math.abs([...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)) % KW_PALETTE.length];

  return (
    <View>
      <Text style={styles.sectionLabel}>Keyword cloud</Text>
      <View style={styles.kwCloud}>
        {keywords.map((k) => {
          const color = colorOf(k.term);
          const t = max === min ? 1 : (k.count - min) / (max - min);
          const size = 12 + Math.round(Math.pow(t, 0.72) * 10);
          return (
            <Pressable
              key={k.term}
              onPress={() => setCoverageKw(k)}
              accessibilityRole="button"
              accessibilityLabel={`${k.term} — view coverage`}
              style={({ pressed }) => [styles.kwChip, { backgroundColor: color + '1A' }, pressed && styles.pressed]}>
              <Text style={[styles.kwChipText, { fontSize: size, color }]}>{k.term}</Text>
            </Pressable>
          );
        })}
      </View>

      <CoverageModal keyword={coverageKw} onClose={() => setCoverageKw(null)} />
    </View>
  );
}

function CoverageModal({ keyword, onClose }: { keyword: ArticleKeyword | null; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop, reset: resetTop } = useScrollToTop();
  useEffect(() => {
    if (keyword) resetTop();
  }, [keyword, resetTop]);
  const dismiss = useDismissGesture(onClose);
  return (
    <Modal visible={keyword !== null} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} title="Coverage" />
            </View>
          </GestureDetector>
          {keyword && (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                onScrollTop(e);
                dismiss.onScroll(e);
              }}
              scrollEventThrottle={16}>
              <View>
                <Text style={styles.covKw}>“{keyword.term}”</Text>
                <Text style={styles.covCount}>
                  {keyword.articles.length} {keyword.articles.length === 1 ? 'article' : 'articles'} mentioning this keyword
                </Text>
              </View>
              <View style={styles.covList}>
                {keyword.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </View>
            </ScrollView>
          )}
        </Animated.View>
        {keyword && <BackToTop visible={showTop} anchor="safe" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />}
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.surfaceWarm },
  fill: { flex: 1 },
  body: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  pressed: { opacity: 0.6 },
  card: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, borderRadius: Spacing.three, padding: Spacing.three, gap: 6 },
  activityType: { fontSize: 12, fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  activityTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24, color: t.text },
  activityDesc: { fontSize: 14, lineHeight: 20, color: t.textSecondary },
  kpiRow: { flexDirection: 'row', gap: Spacing.two },
  kpiCard: { flex: 1, borderRadius: Spacing.three, paddingHorizontal: Spacing.two, paddingVertical: Spacing.three, gap: 4, justifyContent: 'center' },
  kpiPurple: { backgroundColor: '#7C3AED' },
  kpiGreen: { backgroundColor: '#16A34A' },
  kpiDark: { backgroundColor: '#1A1A35' },
  kpiValue: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  kpiLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.85)' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  actionActive: { backgroundColor: t.track },
  actionText: { fontSize: 13, fontWeight: '600', color: t.text },
  summaryPanel: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, borderRadius: Spacing.two, padding: Spacing.three, gap: 6 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryLabelText: { fontSize: 12, fontWeight: '700', color: t.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summaryLoadingText: { fontSize: 13, color: t.textSecondary },
  summarySub: { fontSize: 11, fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  summaryText: { fontSize: 13, lineHeight: 19, color: t.text },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: Spacing.two },
  empty: { fontSize: 13, color: t.textSecondary, paddingVertical: Spacing.four, textAlign: 'center' },
  tabBar: { backgroundColor: t.surfaceWarm, borderBottomWidth: 1, borderBottomColor: t.border },
  tabBarInner: { flexDirection: 'row', gap: Spacing.three },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.two, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: t.text },
  tabText: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
  tabTextActive: { color: t.text },
  covList: { gap: Spacing.five },
  matchRow: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, borderRadius: 12, padding: Spacing.three, gap: 3 },
  matchOutlet: { fontSize: 12, fontWeight: '700', color: t.text },
  matchTitle: { fontSize: 14, lineHeight: 19, color: t.text },
  matchMeta: { fontSize: 11, color: t.textSecondary },
  timeline: { marginTop: Spacing.one },
  tlRow: { flexDirection: 'row', gap: Spacing.two },
  tlRail: { width: 28, alignItems: 'center' },
  tlNode: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' },
  tlNodeAccent: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  tlLine: { flex: 1, width: 2, backgroundColor: t.border, marginVertical: 2 },
  tlCardWrap: { flex: 1, paddingBottom: Spacing.three },
  tlCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, borderRadius: 12, padding: Spacing.three },
  tlCardMain: { flex: 1, gap: 2 },
  tlTitle: { fontSize: 14, fontWeight: '700', color: t.text },
  tlSub: { fontSize: 12, color: t.textSecondary },
  tlMeta: { fontSize: 12, fontWeight: '600', color: t.positive },
  tlPosts: { gap: Spacing.two, paddingTop: Spacing.two },
  tlPost: { gap: 2, borderLeftWidth: 2, borderLeftColor: t.border, paddingLeft: Spacing.two },
  tlPostHandle: { fontSize: 12, fontWeight: '700', color: t.text },
  tlPostText: { fontSize: 12, lineHeight: 16, color: t.text },
  tlPostMeta: { fontSize: 11, color: t.textSecondary },
  kwCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  kwChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  kwChipText: { fontWeight: '700' },
  covKw: { fontSize: 24, fontWeight: '800', color: t.text },
  covCount: { fontSize: 13, color: t.textSecondary, marginTop: 2 },
});
