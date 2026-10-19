import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PLATFORM_ICON } from '@/components/author-avatar';
import { getEngagementItems } from '@/components/mention-card';
import { ALL_PLATFORMS } from '@/components/mentions-filters-sheet';
import { Spacing, Theme } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { Sentiment, SocialMention, SocialPlatform } from '@/data/types';

// Ported from the v4-client web app's Today's Brief (SharedView variant).
// These colored-tile / chip-tint values are intentionally fixed across light
// and dark — the colored tiles always carry white text and the chip tints read
// fine on either canvas. Surface/text tokens come from the theme instead.
const BRAND = {
  pulse: '#22C55E',
  aiTagBg: 'rgba(185, 164, 247, 0.18)',
  aiTagBorder: 'rgba(185, 164, 247, 0.35)',
  trendingBg: 'rgba(251, 191, 36, 0.15)',
  trendingBorder: 'rgba(251, 191, 36, 0.3)',
  tilePosts: '#1A1A35',
  sentimentPositive: '#16A34A',
  sentimentNeutral: '#9CA3AF',
  sentimentNegative: '#E94F37',
};

const SENTIMENT_TILE_BG: Record<Sentiment, string> = {
  positive: BRAND.sentimentPositive,
  neutral: BRAND.sentimentNeutral,
  negative: BRAND.sentimentNegative,
};

// Compact names sized for a three-across stat row on phone widths.
export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  twitter: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  tiktok: 'TikTok',
};

const TRENDING_LIMIT = 3;
const COUNT_UP_DURATION = 700;

export function totalEngagement(mention: SocialMention): number {
  return getEngagementItems(mention).reduce((sum, item) => sum + item.count, 0);
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function rankByEngagement(mentions: SocialMention[]): SocialMention[] {
  return [...mentions].sort((a, b) => totalEngagement(b) - totalEngagement(a));
}

export interface BriefStats {
  topPlatform: SocialPlatform;
  topPlatformCount: number;
  dominantSentiment: Sentiment;
  dominantPct: number;
  trending: SocialMention[];
  trendingEntity: string | null;
}

// Shared by the feed card and the /brief page so both always show the same
// numbers for the same mention set.
export function deriveBriefStats(mentions: SocialMention[]): BriefStats {
  const platformCounts = new Map<SocialPlatform, number>();
  const sentimentCounts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const mention of mentions) {
    platformCounts.set(mention.platform, (platformCounts.get(mention.platform) ?? 0) + 1);
    sentimentCounts[mention.sentiment] += 1;
  }

  // Stable platform order breaks count ties deterministically.
  const topPlatform = ALL_PLATFORMS.reduce<SocialPlatform>(
    (best, p) => ((platformCounts.get(p) ?? 0) > (platformCounts.get(best) ?? 0) ? p : best),
    ALL_PLATFORMS[0],
  );

  const dominantSentiment = (Object.keys(sentimentCounts) as Sentiment[]).reduce((best, s) =>
    sentimentCounts[s] > sentimentCounts[best] ? s : best,
  );
  const dominantPct = mentions.length
    ? Math.round((sentimentCounts[dominantSentiment] / mentions.length) * 100)
    : 0;

  const trending = rankByEngagement(mentions).slice(0, TRENDING_LIMIT);

  return {
    topPlatform,
    topPlatformCount: platformCounts.get(topPlatform) ?? 0,
    dominantSentiment,
    dominantPct,
    trending,
    trendingEntity: trending[0]?.entities[0] ?? null,
  };
}

// Eased 0 → target tween for the stat numbers, mirroring the web brief's
// countUp(). `nonce` retriggers the run on refresh even though target is
// unchanged (the sample data is static).
function useCountUp(target: number, nonce: number): number {
  const [display, setDisplay] = useState(target);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.setValue(0);
    const id = progress.addListener(({ value }) => setDisplay(Math.round(value * target)));
    Animated.timing(progress, {
      toValue: 1,
      duration: COUNT_UP_DURATION,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start(() => progress.removeListener(id));
    return () => progress.removeListener(id);
  }, [target, nonce, progress]);

  return display;
}

export function BriefStatTiles({
  stats,
  total,
  nonce,
}: {
  stats: BriefStats;
  total: number;
  nonce: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const { isDark } = useThemeMode();
  // The navy "posts" tile is dark-on-dark against the #222222 card — swap to a
  // vivid indigo in dark so it pops like the green sentiment tile. Light keeps
  // the original navy (contrasts fine on the white card).
  const postsTileBg = isDark ? '#4F46E5' : BRAND.tilePosts;
  const sentimentDisplay = useCountUp(stats.dominantPct, nonce);
  const postsDisplay = useCountUp(stats.trending.length, nonce);

  return (
    <View style={styles.statsRow}>
      <View style={[styles.tile, styles.tileSource]}>
        <View style={styles.tileValueRow}>
          <Image source={PLATFORM_ICON[stats.topPlatform]} style={styles.platformIcon} />
          <Text style={styles.tileValueDark} numberOfLines={1}>
            {PLATFORM_LABEL[stats.topPlatform]}
          </Text>
        </View>
        <Text style={styles.tileLabelDark} numberOfLines={1}>
          top source · {stats.topPlatformCount}/{total}
        </Text>
      </View>

      <View style={[styles.tile, { backgroundColor: SENTIMENT_TILE_BG[stats.dominantSentiment] }]}>
        <View style={styles.tileValueRow}>
          <Text style={styles.tileValueLight} numberOfLines={1}>
            {sentimentDisplay}%
          </Text>
          <View style={styles.sentimentPill}>
            <Text style={styles.sentimentPillText}>{stats.dominantSentiment}</Text>
          </View>
        </View>
        <Text style={styles.tileLabelLight} numberOfLines={1}>
          sentiment today
        </Text>
      </View>

      <View style={[styles.tile, { backgroundColor: postsTileBg }]}>
        <Text style={styles.tileValueLight} numberOfLines={1}>
          {postsDisplay}
        </Text>
        <Text style={styles.tileLabelLight} numberOfLines={1}>
          posts
        </Text>
      </View>
    </View>
  );
}

export function TodaysBriefCard({
  mentions,
  category,
}: {
  mentions: SocialMention[];
  category?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  // The lilac "Smart Brief" and amber "trending" chip labels are too dark to
  // read on the charcoal canvas — swap to their lightened variants in dark.
  const aiTagColor = isDark ? '#C4B5FD' : '#6B4DE8';
  const trendingColor = isDark ? '#FBBF24' : '#92400E';
  const router = useRouter();
  const [updatedLabel, setUpdatedLabel] = useState('Updated 2 min ago');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const spinProgress = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseOpacity]);

  const stats = useMemo(() => deriveBriefStats(mentions), [mentions]);

  if (mentions.length === 0) return null;

  function handleRefresh() {
    spinProgress.setValue(0);
    Animated.timing(spinProgress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setUpdatedLabel('Updated just now');
    setRefreshNonce((n) => n + 1);
  }

  function openFullBrief() {
    router.push({ pathname: '/brief', params: category ? { category } : {} });
  }

  const spin = spinProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseOpacity }]} />
        <Text style={styles.title}>
          Today&apos;s brief — {stats.trending.length} trending{' '}
          {stats.trending.length === 1 ? 'story' : 'stories'} flagged
        </Text>
        <Pressable
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Regenerate brief"
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={16} color={theme.text} />
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={11} color={aiTagColor} />
          <Text style={[styles.aiTagText, { color: aiTagColor }]}>Smart Brief</Text>
        </View>
        <View style={styles.updatedRow}>
          <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        </View>
        {stats.trendingEntity && (
          <View style={styles.trendingChip}>
            <Ionicons name="flame" size={11} color={trendingColor} />
            <Text style={[styles.trendingChipText, { color: trendingColor }]} numberOfLines={1}>
              {stats.trendingEntity} trending
            </Text>
          </View>
        )}
      </View>

      <BriefStatTiles stats={stats} total={mentions.length} nonce={refreshNonce} />

      <Pressable
        onPress={openFullBrief}
        accessibilityRole="button"
        accessibilityLabel="View full brief"
        style={({ pressed }) => [styles.footerToggle, pressed && styles.pressed]}>
        <Text style={styles.footerToggleText}>View full brief</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.text} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 16,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    // Toggle's 8pt paddingBottom + this 8pt = the same 16pt inset as the
    // card's other three sides.
    paddingBottom: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.pulse,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: -0.2,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND.aiTagBg,
    borderWidth: 1,
    borderColor: BRAND.aiTagBorder,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  aiTagText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updatedText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND.trendingBg,
    borderWidth: 1,
    borderColor: BRAND.trendingBorder,
    borderRadius: 8,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 3,
    flexShrink: 1,
  },
  trendingChipText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    marginTop: Spacing.three,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two + 4,
    justifyContent: 'space-between',
    gap: 4,
  },
  tileSource: {
    backgroundColor: theme.elevated,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformIcon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  tileValueDark: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    flexShrink: 1,
  },
  tileValueLight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileLabelDark: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  tileLabelLight: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  sentimentPill: {
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sentimentPillText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  footerToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  pressed: {
    opacity: 0.6,
  },
});
