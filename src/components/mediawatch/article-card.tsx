// MediaWatch article card — the article analogue of MentionCard, reused by the
// Mentions feed, Brief coverage, Activity Tracker matched list, Search, and the
// Publisher/Author article lists. Tapping opens the ArticleDetailModal; the ···
// overlay opens a light options sheet. Driven entirely by a NewsArticle.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { SENTIMENT_DOT, cardPalette } from '@/components/detail-primitives';
import { ArticleDetailModal } from '@/components/mediawatch/article-detail';
import { MediaTypeIcon } from '@/components/mediawatch/article-ui';
import { SaveToFolderSheet } from '@/components/save-to-folder-sheet';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { formatAve } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';

const SHEET_OFFSCREEN_Y = 400;

export function ArticleCard({ article, matchScore }: { article: NewsArticle; matchScore?: number }) {
  const { accentColor } = useAuth();
  const { isSaved, toggleSave } = useBookmarks();
  const { isArticleSaved } = useSavedArticles();
  const saved = isSaved(article.url);
  const tracked = isArticleSaved(article.url);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;

  function closeMenu() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setMenuOpen(false));
  }

  useEffect(() => {
    if (!menuOpen) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSCREEN_Y);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuOpen, backdropOpacity, sheetTranslateY]);

  return (
    <View style={styles.cardContainer}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setDetailsVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Open article: ${article.title}`}>
        <View style={[styles.sourceRow, styles.cardSourceRow]}>
          <MediaTypeIcon type={article.mediaType} size={36} />
          <View style={styles.identity}>
            <View style={styles.nameLine}>
              <Text style={styles.outlet} numberOfLines={1}>
                {article.outlet}
              </Text>
              <View style={[styles.sentimentDot, { backgroundColor: SENTIMENT_DOT[article.sentiment] }]} />
            </View>
            <Text style={styles.subMeta} numberOfLines={1}>
              {article.section} · {article.ago}
            </Text>
          </View>
        </View>

        <Text style={styles.headline} numberOfLines={3}>
          {article.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>SV</Text>
              <Text style={styles.metricValue}>{article.storyValue.toFixed(2)}</Text>
            </View>
            <View style={styles.metricDivider} />
            <Text style={styles.ave}>{formatAve(article.ave)}</Text>
          </View>
          {matchScore !== undefined && (
            <View style={styles.matchBlock}>
              <Text style={[styles.matchText, matchScore < 85 && styles.matchTextMid]}>{matchScore}% match</Text>
              <View style={styles.matchTrack}>
                <View style={[styles.matchFill, matchScore < 85 && styles.matchFillMid, { width: `${matchScore}%` }]} />
              </View>
            </View>
          )}
        </View>
      </Pressable>

      <Pressable
        hitSlop={8}
        onPress={() => setMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [styles.cardMenuButton, pressed && styles.pressed]}>
        <Ionicons name="ellipsis-horizontal" size={18} color={cardPalette.textSecondary} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="none" statusBarTranslucent onRequestClose={closeMenu}>
        <View style={styles.sheetContainer}>
          <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeMenu}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            />
          </Animated.View>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <SheetRow
              icon={saved ? 'bookmark' : 'bookmark-outline'}
              label={saved ? 'Remove bookmark' : 'Bookmark article'}
              color={saved ? accentColor : undefined}
              onPress={() => { closeMenu(); toggleSave(article.url); }}
            />
            <SheetRow
              icon={tracked ? 'file-tray-full' : 'file-tray-full-outline'}
              label={tracked ? 'Move to folder' : 'Add to Saved Articles'}
              color={tracked ? accentColor : undefined}
              onPress={() => { closeMenu(); setSaveSheetOpen(true); }}
            />
            <SheetRow
              icon="share-social-outline"
              label="Share"
              onPress={() => { closeMenu(); Share.share({ message: `${article.title}\n\n${article.url}`, url: article.url }); }}
            />
            <SheetRow
              icon="document-text-outline"
              label="View Article Details"
              onPress={() => { closeMenu(); setDetailsVisible(true); }}
            />
          </Animated.View>
        </View>
      </Modal>

      <ArticleDetailModal visible={detailsVisible} article={article} onClose={() => setDetailsVisible(false)} />
      <SaveToFolderSheet visible={saveSheetOpen} url={article.url} onClose={() => setSaveSheetOpen(false)} />
    </View>
  );
}

function SheetRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={color ?? cardPalette.text} />
      <Text style={[styles.sheetRowText, color && { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: { position: 'relative' },
  card: { gap: Spacing.two },
  cardPressed: { opacity: 0.7 },
  cardSourceRow: { paddingRight: 32 },
  cardMenuButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outlet: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: cardPalette.text },
  sentimentDot: { width: 6, height: 6, borderRadius: 3 },
  subMeta: { fontSize: 11, color: cardPalette.textSecondary },
  headline: { fontSize: 16, fontWeight: '600', lineHeight: 22, color: cardPalette.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  metric: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: '700', color: cardPalette.textSecondary },
  metricValue: { fontSize: 14, fontWeight: '700', color: cardPalette.text },
  metricDivider: { width: 1, height: 12, backgroundColor: cardPalette.border },
  ave: { fontSize: 13, fontWeight: '600', color: cardPalette.textSecondary },
  matchBlock: { alignItems: 'flex-end', gap: 3 },
  matchText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  matchTextMid: { color: '#D97706' },
  matchTrack: { width: 64, height: 3, borderRadius: 2, backgroundColor: cardPalette.track },
  matchFill: { height: 3, borderRadius: 2, backgroundColor: '#16A34A' },
  matchFillMid: { backgroundColor: '#D97706' },
  pressed: { opacity: 0.5 },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26, 26, 26, 0.4)' },
  sheet: {
    backgroundColor: cardPalette.card,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: cardPalette.border,
    marginBottom: Spacing.two,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  sheetRowText: { fontSize: 15, fontWeight: '600', color: cardPalette.text },
});
