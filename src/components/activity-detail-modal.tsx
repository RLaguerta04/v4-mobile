import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { MentionCard } from '@/components/mention-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { TrackerMedia } from '@/data/types';
import {
  buildTimeline,
  computeKeywords,
  formatPhp,
  Keyword,
  keywordInsight,
  KW_CATS,
  postsForActivity,
  ResolvedActivity,
  TimelineStage,
} from '@/utils/metrics';

type IoniconName = keyof typeof Ionicons.glyphMap;
type TabKey = 'matches' | 'timeline' | 'keywords';

const DETAIL_TABS: { key: TabKey; label: string; icon: IoniconName }[] = [
  { key: 'matches', label: 'Matched posts', icon: 'list-outline' },
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

// Parse a compact audience figure ("84K", "6.2K", "1.2M") to a number, and back.
function parseCompact(s?: string): number {
  if (!s) return 0;
  const m = /^([\d.]+)\s*([km]?)/i.exec(s.trim());
  if (!m) return 0;
  const mult = m[2].toLowerCase() === 'm' ? 1e6 : m[2].toLowerCase() === 'k' ? 1e3 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}
function formatCompact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${n}`;
}
function truncatePost(s: string): string {
  return s.length > 80 ? `${s.slice(0, 77).trimEnd()}…` : s;
}

// Simulated AI synthesis of an activity's matched posts — deterministic, local.
function buildActivitySummary(activity: ResolvedActivity): { gist: string; read: string } {
  const posts = postsForActivity(activity);
  const platforms = [...new Set(posts.map((p) => p.platform))];
  const handles = [...new Set(posts.map((p) => p.handle))];
  const totalReach = posts.reduce((s, p) => s + parseCompact(p.estReach), 0);
  const top = posts.length
    ? posts.reduce((b, p) => (parseCompact(p.estReach) > parseCompact(b.estReach) ? p : b))
    : undefined;
  const gist = `"${activity.title}" drew ${posts.length} matched ${
    posts.length === 1 ? 'post' : 'posts'
  } across ${platforms.length} ${platforms.length === 1 ? 'platform' : 'platforms'}${
    totalReach ? `, reaching an estimated ${formatCompact(totalReach)} people` : ''
  }.`;
  const read = posts.length
    ? `Conversation is led by ${handles.slice(0, 3).join(', ')}${
        handles.length > 3 ? ' and others' : ''
      }.${
        top
          ? ` The most visible post — “${truncatePost(top.post)}” (${top.handle})${
              top.estReach ? ` — reached ${top.estReach}` : ''
            }.`
          : ''
      }`
    : 'No posts have been matched to this activity yet — it fills in as mentions are found.';
  return { gist, read };
}

export function ActivityDetailModal({
  activity,
  onClose,
}: {
  activity: ResolvedActivity | null;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accentColor = useAccentColor();
  const { isSaved, toggleSave } = useBookmarks();

  const [tab, setTab] = useState<TabKey>('matches');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{ gist: string; read: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop, reset: resetTop } = useScrollToTop();

  // Start hidden each time a new activity opens (the component stays mounted).
  useEffect(() => {
    if (activity) resetTop();
  }, [activity, resetTop]);
  const dismiss = useDismissGesture(handleClose);

  // The social posts matched to this activity — drives the Matched-posts tab,
  // its count, and the Matched KPI (Timeline / list stay on the article model).
  const posts = activity ? postsForActivity(activity) : [];

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
      setSummary(buildActivitySummary(a));
      setSummaryLoading(false);
    }, 1100);
  }
  function openSummary() {
    setSummaryOpen(true);
    if (!summary && !summaryLoading) runSummary();
  }
  function exportActivity() {
    if (!activity) return;
    const lines = posts.map((p) => `• ${p.handle}: ${p.post}`).join('\n');
    const message = `${activity.title}\n${activity.type} · ${posts.length} matched ${
      posts.length === 1 ? 'post' : 'posts'
    }\n\n${lines}`;
    Share.share({ message }).catch(() => {});
  }

  return (
    <Modal
      visible={activity !== null}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={handleClose} title="Activity" />
            </View>
          </GestureDetector>

          {activity && (
            // stickyHeaderIndices targets child 2 = the tab bar (0 brief card · 1 KPI row · 2 tab bar).
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
                <Text style={styles.kpiValue}>{posts.length}</Text>
                <Text style={styles.kpiLabel}>AI matches</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiGreen]}>
                <Text style={styles.kpiValue}>{activity.avgMatch}%</Text>
                <Text style={styles.kpiLabel}>avg similarity</Text>
              </View>
              <View style={[styles.kpiCard, styles.kpiDark]}>
                <Text style={[styles.kpiValue, styles.kpiValueMuted]}>0</Text>
                <Text style={styles.kpiLabel}>manually added</Text>
              </View>
            </View>

            <View style={styles.tabBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabBarInner}>
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
                      <Text style={[styles.tabText, on && styles.tabTextActive]}>
                        {t.label}
                        {t.key === 'matches' ? ` (${posts.length})` : ''}
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
                    style={({ pressed }) => [
                      styles.action,
                      summaryOpen && styles.actionActive,
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons
                      name="sparkles-outline"
                      size={15}
                      color={summaryOpen ? accentColor : theme.text}
                    />
                    <Text style={[styles.actionText, summaryOpen && { color: accentColor }]}>
                      AI summary
                    </Text>
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
                      <View style={styles.summaryActions}>
                        {!summaryLoading && summary && (
                          <Pressable
                            onPress={runSummary}
                            accessibilityRole="button"
                            accessibilityLabel="Regenerate summary"
                            hitSlop={8}
                            style={({ pressed }) => pressed && styles.pressed}>
                            <Ionicons name="refresh" size={15} color={theme.textSecondary} />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => setSummaryOpen(false)}
                          accessibilityRole="button"
                          accessibilityLabel="Hide summary"
                          hitSlop={8}
                          style={({ pressed }) => pressed && styles.pressed}>
                          <Ionicons name="close" size={16} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    </View>

                    {summaryLoading || !summary ? (
                      <View style={styles.summaryLoadingRow}>
                        <ActivityIndicator size="small" color={accentColor} />
                        <Text style={styles.summaryLoadingText}>Reading the matched coverage…</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.summarySection}>
                          <Text style={styles.summarySub}>Overview</Text>
                          <Text style={styles.summaryText}>{summary.gist}</Text>
                        </View>
                        <View style={styles.summarySection}>
                          <Text style={styles.summarySub}>What the coverage says</Text>
                          <Text style={styles.summaryText}>{summary.read}</Text>
                        </View>
                        <View style={styles.summaryNote}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={12}
                            color={theme.textSecondary}
                          />
                          <Text style={styles.summaryNoteText}>
                            Generated by AI from the matched coverage — verify before use.
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {posts.length === 0 ? (
                  <Text style={styles.empty}>No matched posts yet.</Text>
                ) : (
                  <View style={styles.covList}>
                    {posts.map((p) => (
                      <MentionCard
                        key={p.url}
                        mention={p}
                        saved={isSaved(p.url)}
                        onToggleSave={() => toggleSave(p.url)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
            {tab === 'timeline' && <Timeline activity={activity} />}
            {tab === 'keywords' && <KeywordCloud activity={activity} />}
            </ScrollView>
          )}
        </Animated.View>

        {activity && (
          <BackToTop
            visible={showTop}
            anchor="safe"
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Timeline tab ──
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
        const icon =
          stage.kind === 'media' && stage.media ? MEDIA_ICON[stage.media] : TL_ICON[stage.kind];
        const open = expanded.has(stage.key);
        const expandable = !!(stage.posts && stage.posts.length);
        return (
          <View key={stage.key} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlNode, stage.kind === 'total' && styles.tlNodeAccent]}>
                <Ionicons
                  name={icon}
                  size={13}
                  color={stage.kind === 'total' ? '#FFFFFF' : theme.text}
                />
              </View>
              {i < stages.length - 1 && <View style={styles.tlLine} />}
            </View>
            <View style={styles.tlCardWrap}>
              <Pressable
                disabled={!expandable}
                onPress={() => toggle(stage.key)}
                accessibilityRole={expandable ? 'button' : undefined}
                style={({ pressed }) => [styles.tlCard, pressed && expandable && styles.pressed]}>
                <View style={styles.tlCardMain}>
                  <Text style={styles.tlTitle}>{stage.title}</Text>
                  {stage.sub && <Text style={styles.tlSub}>{stage.sub}</Text>}
                  {stage.meta && <Text style={styles.tlMeta}>{stage.meta}</Text>}
                </View>
                {expandable && (
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textSecondary}
                  />
                )}
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

// ── Keyword Cloud tab ──
function KeywordCloud({ activity }: { activity: ResolvedActivity }) {
  const styles = useThemedStyles(makeStyles);
  const keywords = computeKeywords(activity);
  const [coverageKw, setCoverageKw] = useState<Keyword | null>(null);
  if (!keywords.length) {
    return <Text style={styles.empty}>No keywords for this activity.</Text>;
  }
  const max = keywords[0].count;
  const min = keywords[keywords.length - 1].count;
  const top10 = keywords.slice(0, 10);

  return (
    <View>
      <Text style={styles.sectionLabel}>Keyword Insight</Text>
      <Text style={styles.kwSub}>{keywordInsight(activity, keywords)}</Text>

      <View style={styles.kwCloud}>
        {keywords.map((k) => {
          const color = KW_CATS[k.cat]?.color ?? '#6B4DE8';
          const t = max === min ? 1 : (k.count - min) / (max - min);
          const size = 12 + Math.round(Math.pow(t, 0.72) * 10);
          return (
            <Pressable
              key={k.term}
              onPress={() => setCoverageKw(k)}
              accessibilityRole="button"
              accessibilityLabel={`${k.term} — view coverage`}
              style={({ pressed }) => [
                styles.kwChip,
                { backgroundColor: color + '1A' },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.kwChipText, { fontSize: size, color }]}>{k.term}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.kwDivider} />

      <Text style={styles.sectionLabel}>Top 10 keywords</Text>
      <View style={styles.top10}>
        {top10.map((k, i) => {
          const color = KW_CATS[k.cat]?.color ?? '#6B4DE8';
          return (
            <Pressable
              key={k.term}
              onPress={() => setCoverageKw(k)}
              accessibilityRole="button"
              accessibilityLabel={`${k.term} — view coverage`}
              style={({ pressed }) => [styles.top10Row, pressed && styles.pressed]}>
              <Text style={styles.top10Rank}>{i + 1}</Text>
              <View style={[styles.top10Dot, { backgroundColor: color }]} />
              <Text style={styles.top10Term} numberOfLines={1}>
                {k.term}
              </Text>
              <Text style={styles.top10Count}>{k.count}</Text>
            </Pressable>
          );
        })}
      </View>

      <CoverageModal keyword={coverageKw} onClose={() => setCoverageKw(null)} />
    </View>
  );
}

// ── Keyword coverage page (opened by tapping a keyword) ──
function CoverageModal({ keyword, onClose }: { keyword: Keyword | null; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSave } = useBookmarks();
  const scrollRef = useRef<ScrollView>(null);
  const { visible: showTop, onScroll: onScrollTop, reset: resetTop } = useScrollToTop();
  useEffect(() => {
    if (keyword) resetTop();
  }, [keyword, resetTop]);
  const dismiss = useDismissGesture(onClose);
  return (
    <Modal
      visible={keyword !== null}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
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
                {keyword.posts.length} {keyword.posts.length === 1 ? 'post' : 'posts'} mentioning
                this keyword
              </Text>
            </View>
            <View style={styles.covList}>
              {keyword.posts.map((p) => (
                <MentionCard
                  key={p.url}
                  mention={p}
                  saved={isSaved(p.url)}
                  onToggleSave={() => toggleSave(p.url)}
                />
              ))}
            </View>
            </ScrollView>
          )}
        </Animated.View>

        {keyword && (
          <BackToTop
            visible={showTop}
            anchor="safe"
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )}
      </GestureHandlerRootView>
    </Modal>
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
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: t.card,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: t.text,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },

  card: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 6,
  },
  activityType: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    color: t.text,
  },
  activityDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: t.textSecondary,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  kpiCard: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    gap: 4,
    justifyContent: 'center',
  },
  // Colored KPI tiles carry white text in both schemes — kept fixed.
  kpiPurple: {
    backgroundColor: '#7C3AED',
  },
  kpiGreen: {
    backgroundColor: '#16A34A',
  },
  kpiDark: {
    backgroundColor: '#1A1A35',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiValueMuted: {
    opacity: 0.55,
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.borderCool,
    backgroundColor: t.card,
  },
  actionActive: {
    borderColor: t.borderCool,
    backgroundColor: t.track,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },

  summaryPanel: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  summaryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  summaryLoadingText: {
    fontSize: 13,
    color: t.textSecondary,
  },
  summarySection: {
    gap: 2,
  },
  summarySub: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: t.text,
  },
  summaryNote: {
    flexDirection: 'row',
    gap: 5,
    marginTop: Spacing.one,
  },
  summaryNoteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: t.textSecondary,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  empty: {
    fontSize: 13,
    color: t.textSecondary,
    paddingVertical: Spacing.four,
    textAlign: 'center',
  },

  // Tab bar (Matched posts / Timeline / Keyword Cloud) — sticky header, so it
  // needs a solid background to cover rows scrolling underneath when pinned.
  tabBar: {
    backgroundColor: t.surfaceWarm,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  tabBarInner: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
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

  // Timeline
  timeline: {
    marginTop: Spacing.one,
  },
  tlRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tlRail: {
    width: 28,
    alignItems: 'center',
  },
  tlNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.borderCool,
    backgroundColor: t.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Accent "total" node — fixed brand purple with a white icon.
  tlNodeAccent: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  tlLine: {
    flex: 1,
    width: 2,
    backgroundColor: t.borderCool,
    marginVertical: 2,
  },
  tlCardWrap: {
    flex: 1,
    paddingBottom: Spacing.three,
  },
  tlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorderCool,
    borderRadius: 12,
    padding: Spacing.three,
  },
  tlCardMain: {
    flex: 1,
    gap: 2,
  },
  tlTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
  },
  tlSub: {
    fontSize: 12,
    color: t.textSecondary,
  },
  tlMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: t.positive,
  },
  tlPosts: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  tlPost: {
    gap: 2,
    borderLeftWidth: 2,
    borderLeftColor: t.borderCool,
    paddingLeft: Spacing.two,
  },
  tlPostHandle: {
    fontSize: 12,
    fontWeight: '700',
    color: t.text,
  },
  tlPostText: {
    fontSize: 12,
    lineHeight: 16,
    color: t.text,
  },
  tlPostMeta: {
    fontSize: 11,
    color: t.textSecondary,
  },

  // Keyword cloud
  kwSub: {
    fontSize: 13,
    color: t.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.two,
  },
  kwCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kwDivider: {
    height: 1,
    backgroundColor: t.borderCool,
    marginTop: Spacing.four,
    marginBottom: Spacing.one,
  },

  // Keyword coverage page — the home feed's MentionCard, one per matched post.
  covKw: {
    fontSize: 24,
    fontWeight: '800',
    color: t.text,
  },
  covCount: {
    fontSize: 13,
    color: t.textSecondary,
    marginTop: 2,
  },
  // Feed-style list: cards separated by spacing, like the home feed.
  covList: {
    gap: Spacing.five,
  },
  kwChip: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  kwChipText: {
    fontWeight: '700',
  },

  // Top 10 keywords list
  top10: {
    marginTop: Spacing.two,
    gap: 2,
  },
  top10Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
  },
  top10Rank: {
    width: 20,
    fontSize: 13,
    fontWeight: '700',
    color: t.textSecondary,
    textAlign: 'center',
  },
  top10Dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  top10Term: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: t.text,
  },
  top10Count: {
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
  },
});
