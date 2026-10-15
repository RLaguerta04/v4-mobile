// MediaWatch article card — the article analogue of MentionCard, reused by the
// Mentions feed, Brief coverage, Activity Tracker matched list, Search, and the
// Publisher/Author article lists. Tapping opens the ArticleDetailModal; the ···
// overlay opens a light options sheet. Driven entirely by a NewsArticle.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { SENTIMENT_DOT, cardPalette } from '@/components/detail-primitives';
import { ArticleDetailModal } from '@/components/mediawatch/article-detail';
import { AudioAttachment, DocumentAttachment, MEDIA_TYPE_META, MediaTypeIcon } from '@/components/mediawatch/article-ui';
import { SaveToFolderSheet } from '@/components/save-to-folder-sheet';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { formatAve } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';

const SHEET_OFFSCREEN_Y = 400;
const PRINT_TYPES = new Set(['broadsheet', 'provincial', 'tabloid', 'magazine']);

// The card's media slot — what's shown depends entirely on mediaType, mirroring
// how each medium's attachment differs in the reference reader (photo, video
// poster, waveform, scanned page). Online/tv only show one when a thumbnail
// was actually captured; radio/print always carry their attachment.
function ArticleMedia({ article }: { article: NewsArticle }) {
  if ((article.mediaType === 'online' || article.mediaType === 'blog' || article.mediaType === 'tv') && article.thumbnail) {
    return (
      <View style={styles.thumb}>
        <Image source={article.thumbnail} style={styles.thumbImage} resizeMode="cover" />
        {article.mediaType === 'tv' && (
          <View style={styles.playBadge}>
            <View style={styles.playBadgeCircle}>
              <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}
      </View>
    );
  }
  if (article.mediaType === 'radio') return <AudioAttachment article={article} />;
  if (PRINT_TYPES.has(article.mediaType)) return <DocumentAttachment article={article} />;
  return null;
}

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
              {MEDIA_TYPE_META[article.mediaType].label} · {article.author} · {article.ago}
            </Text>
          </View>
        </View>

        <Text style={styles.headline} numberOfLines={3}>
          {article.title}
        </Text>

        <ArticleMedia article={article} />

        <View style={styles.metaRow}>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Ionicons name="star-outline" size={13} color={cardPalette.textSecondary} />
              <Text style={styles.metricValue}>{article.storyValue.toFixed(2)}</Text>
            </View>
            <View style={styles.metric}>
              <Ionicons name="cash-outline" size={13} color={cardPalette.textSecondary} />
              <Text style={styles.metricValue}>{formatAve(article.ave)}</Text>
            </View>
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
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    backgroundColor: cardPalette.track,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.22)',
  },
  playBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.55)',
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
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 12, fontWeight: '600', color: cardPalette.textSecondary },
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
