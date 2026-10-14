// MediaWatch Today's Brief card — the article analogue of TodaysBriefCard.
// Same visual language (Smart Brief tag, pulse, 3 stat tiles, "View full
// brief"), but the stats are article-native: top outlet, combined AVE, and
// sentiment split. Navigates to /brief, which branches to the article brief.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { deriveArticleBriefStats, formatAve } from '@/data/mediawatch-metrics';
import { mediawatchTrending } from '@/data/mediawatch-articles';
import type { NewsArticle } from '@/data/mediawatch-types';
import type { Sentiment } from '@/data/types';

const palette = {
  card: '#FFFFFF',
  border: '#E4E6EA',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  pulse: '#22C55E',
  aiTagBg: 'rgba(185, 164, 247, 0.18)',
  aiTagBorder: 'rgba(185, 164, 247, 0.35)',
  aiTagText: '#6B4DE8',
  trendingBg: 'rgba(251, 191, 36, 0.15)',
  trendingBorder: 'rgba(251, 191, 36, 0.3)',
  trendingText: '#92400E',
  tileSource: '#F0EEEC',
  tileAve: '#1A1A35',
  sentimentPositive: '#16A34A',
  sentimentNeutral: '#9CA3AF',
  sentimentNegative: '#E94F37',
};

const SENTIMENT_TILE_BG: Record<Sentiment, string> = {
  positive: palette.sentimentPositive,
  neutral: palette.sentimentNeutral,
  negative: palette.sentimentNegative,
};

export function ArticleBriefCard({ articles, category }: { articles: NewsArticle[]; category?: string }) {
  const router = useRouter();
  const [updatedLabel, setUpdatedLabel] = useState('Updated 2 min ago');
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

  const stats = useMemo(() => deriveArticleBriefStats(articles), [articles]);
  const trendingTitle = mediawatchTrending[0]?.entities[0] ?? null;

  if (articles.length === 0) return null;

  function handleRefresh() {
    spinProgress.setValue(0);
    Animated.timing(spinProgress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    setUpdatedLabel('Updated just now');
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
          Today&apos;s brief — {stats.tier1Count} Tier 1 {stats.tier1Count === 1 ? 'story' : 'stories'} flagged
        </Text>
        <Pressable
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Regenerate brief"
          hitSlop={8}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="refresh" size={16} color={palette.text} />
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.aiTag}>
          <Ionicons name="sparkles" size={11} color={palette.aiTagText} />
          <Text style={styles.aiTagText}>Smart Brief</Text>
        </View>
        <View style={styles.updatedRow}>
          <Ionicons name="time-outline" size={12} color={palette.textSecondary} />
          <Text style={styles.updatedText}>{updatedLabel}</Text>
        </View>
        {trendingTitle && (
          <View style={styles.trendingChip}>
            <Ionicons name="flame" size={11} color={palette.trendingText} />
            <Text style={styles.trendingChipText} numberOfLines={1}>
              {trendingTitle} trending
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.tile, styles.tileSource]}>
          <View style={styles.tileValueRow}>
            <Ionicons name="newspaper-outline" size={14} color={palette.text} />
            <Text style={styles.tileValueDark} numberOfLines={1}>
              {stats.topOutlet}
            </Text>
          </View>
          <Text style={styles.tileLabelDark} numberOfLines={1}>
            top source
          </Text>
        </View>

        <View style={[styles.tile, { backgroundColor: palette.tileAve }]}>
          <Text style={styles.tileValueLight} numberOfLines={1}>
            {formatAve(stats.combinedAve)}
          </Text>
          <Text style={styles.tileLabelLight} numberOfLines={1}>
            combined AVE
          </Text>
        </View>

        <View style={[styles.tile, { backgroundColor: SENTIMENT_TILE_BG[stats.dominantSentiment] }]}>
          <View style={styles.tileValueRow}>
            <Text style={styles.tileValueLight} numberOfLines={1}>
              {stats.sentimentSplit[stats.dominantSentiment]}%
            </Text>
            <View style={styles.sentimentPill}>
              <Text style={styles.sentimentPillText}>{stats.dominantSentiment}</Text>
            </View>
          </View>
          <Text style={styles.tileLabelLight} numberOfLines={1}>
            sentiment today
          </Text>
        </View>
      </View>

      <Pressable
        onPress={openFullBrief}
        accessibilityRole="button"
        accessibilityLabel="View full brief"
        style={({ pressed }) => [styles.footerToggle, pressed && styles.pressed]}>
        <Text style={styles.footerToggleText}>View full brief</Text>
        <Ionicons name="chevron-forward" size={16} color={palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.pulse },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text, letterSpacing: -0.2 },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.aiTagBg,
    borderWidth: 1,
    borderColor: palette.aiTagBorder,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  aiTagText: { fontSize: 10.5, fontWeight: '600', color: palette.aiTagText },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  updatedText: { fontSize: 12, color: palette.textSecondary },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.trendingBg,
    borderWidth: 1,
    borderColor: palette.trendingBorder,
    borderRadius: 8,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 3,
    flexShrink: 1,
  },
  trendingChipText: { fontSize: 12, fontWeight: '600', color: palette.trendingText, flexShrink: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.two + 2, marginTop: Spacing.three },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two + 4,
    justifyContent: 'space-between',
    gap: 4,
  },
  tileSource: { backgroundColor: palette.tileSource },
  tileValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValueDark: { fontSize: 14, fontWeight: '700', color: palette.text, flexShrink: 1 },
  tileValueLight: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  tileLabelDark: { fontSize: 10, color: 'rgba(24, 29, 38, 0.7)' },
  tileLabelLight: { fontSize: 10, color: 'rgba(255, 255, 255, 0.85)' },
  sentimentPill: { flexShrink: 0, backgroundColor: 'rgba(255, 255, 255, 0.22)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  sentimentPillText: { fontSize: 9.5, fontWeight: '600', color: '#FFFFFF' },
  footerToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.two, marginTop: Spacing.two },
  footerToggleText: { fontSize: 13, fontWeight: '600', color: palette.text },
  pressed: { opacity: 0.6 },
});
