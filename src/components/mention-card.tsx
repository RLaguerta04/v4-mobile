import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthorAvatar } from '@/components/author-avatar';
import { MediaMeterColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { SocialMention } from '@/data/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Shared with the Mentions (Home), Bookmark, and Search screens so every
// mention card looks identical wherever it's rendered.
export const cardPalette = {
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  track: '#EDE6D8',
};

// Real Media Meter v4 sentiment tokens (design-system.html), not guessed values.
export const SENTIMENT_DOT: Record<SocialMention['sentiment'], string> = {
  positive: MediaMeterColors.positive,
  neutral: MediaMeterColors.neutralSentiment,
  negative: MediaMeterColors.negative,
};

// Starting/ending Y offset for the options sheet's slide animation — well
// past the sheet's own height, so it's always fully off-screen at rest.
const SHEET_OFFSCREEN_Y = 400;

// capturedAt is authored as "Jul 27, 2026, 11:58 PM" — drop the comma before
// the time so it reads "Jul 27, 2026 11:58 PM" for the "As of ..." line.
function formatCapturedAsOf(capturedAt: string): string {
  return capturedAt.replace(/, (\d{1,2}:\d{2})/, ' $1');
}

// Each platform surfaces the metrics it actually has — Instagram has no
// "views", Reddit has no "shares", etc. — rather than one generic score.
// `label` is only used by the detail modal; the card itself only shows icons.
export function getEngagementItems(
  mention: SocialMention,
): { icon: IoniconName; label: string; count: number }[] {
  switch (mention.platform) {
    case 'facebook':
      return [
        { icon: 'thumbs-up-outline', label: 'Likes', count: mention.engagement.likes },
        { icon: 'chatbubble-outline', label: 'Comments', count: mention.engagement.comments },
        { icon: 'arrow-redo-outline', label: 'Shares', count: mention.engagement.shares },
      ];
    case 'twitter':
      return [
        { icon: 'heart-outline', label: 'Likes', count: mention.engagement.likes },
        { icon: 'chatbubble-outline', label: 'Replies', count: mention.engagement.replies },
        { icon: 'repeat-outline', label: 'Reposts', count: mention.engagement.reposts },
        { icon: 'eye-outline', label: 'Views', count: mention.engagement.views },
      ];
    case 'instagram':
      return [
        { icon: 'heart-outline', label: 'Likes', count: mention.engagement.likes },
        { icon: 'chatbubble-outline', label: 'Comments', count: mention.engagement.comments },
      ];
    case 'youtube':
      return [
        { icon: 'thumbs-up-outline', label: 'Likes', count: mention.engagement.likes },
        { icon: 'chatbubble-outline', label: 'Comments', count: mention.engagement.comments },
        { icon: 'eye-outline', label: 'Views', count: mention.engagement.views },
      ];
    case 'tiktok':
      return [
        { icon: 'heart-outline', label: 'Likes', count: mention.engagement.likes },
        { icon: 'chatbubble-outline', label: 'Comments', count: mention.engagement.comments },
        { icon: 'arrow-redo-outline', label: 'Shares', count: mention.engagement.shares },
        { icon: 'eye-outline', label: 'Views', count: mention.engagement.views },
      ];
    case 'reddit': {
      const items: { icon: IoniconName; label: string; count: number }[] = [
        { icon: 'arrow-up-outline', label: 'Upvotes', count: mention.engagement.upvotes },
        { icon: 'chatbubble-outline', label: 'Comments', count: mention.engagement.comments },
      ];
      if (mention.engagement.awards) {
        items.push({ icon: 'trophy-outline', label: 'Awards', count: mention.engagement.awards });
      }
      return items;
    }
  }
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function MentionCard({
  mention,
  saved,
  onToggleSave,
}: {
  mention: SocialMention;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { accentColor } = useAuth();
  const { isArticleSaved, toggleSaveArticle } = useSavedArticles();
  const articleSaved = isArticleSaved(mention.url);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;
  const engagementItems = getEngagementItems(mention);

  function emailArticle() {
    const subject = encodeURIComponent(`Mention from ${mention.handle}`);
    const body = encodeURIComponent(`${mention.post}\n\n${mention.url}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  function openMenu() {
    setModalVisible(true);
  }

  // The overlay fades in/out on its own timeline while the sheet slides
  // separately — Modal's built-in animationType moves both as one block,
  // which made the backdrop appear to slide up with the sheet instead of
  // just dimming the screen.
  function closeMenu() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  }

  useEffect(() => {
    if (!modalVisible) return;
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
  }, [modalVisible]);

  return (
    <View style={styles.card}>
      <View style={styles.sourceRow}>
        <AuthorAvatar handle={mention.handle} platform={mention.platform} size={36} />
        <View style={styles.identityColumn}>
          <View style={styles.nameLine}>
            <Text style={styles.handle} numberOfLines={1}>
              {mention.handle}
            </Text>
            <View style={[styles.sentimentDot, { backgroundColor: SENTIMENT_DOT[mention.sentiment] }]} />
          </View>
          <Text style={styles.ago} numberOfLines={1}>
            {mention.ago} · <Ionicons name="time-outline" size={11} color={cardPalette.textSecondary} /> As
            of {formatCapturedAsOf(mention.capturedAt)} · UTC
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            hitSlop={8}
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name="ellipsis-horizontal" size={18} color={cardPalette.textSecondary} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.postText} numberOfLines={4}>
        {mention.post}
      </Text>

      {mention.thumb && (
        // Wrapped in a plain View that owns the width/aspectRatio sizing,
        // with the Image only filling it — native Image sizing can otherwise
        // let the source photo's own intrinsic dimensions leak into layout
        // before the percentage width resolves.
        <View style={styles.thumb}>
          <Image source={mention.thumb} style={styles.thumbImage} resizeMode="cover" />
        </View>
      )}

      <View style={styles.metaRow}>
        <View style={styles.engagementRow}>
          {engagementItems.map((item, i) => (
            <View key={i} style={styles.engagementItem}>
              <Ionicons name={item.icon} size={15} color={cardPalette.textSecondary} />
              <Text style={styles.engagementText}>{formatCount(item.count)}</Text>
            </View>
          ))}
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMenu}>
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
            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                onToggleSave();
              }}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove bookmark' : 'Save mention'}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={saved ? accentColor : cardPalette.text}
              />
              <Text style={styles.sheetRowText}>{saved ? 'Remove bookmark' : 'Save mention'}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                toggleSaveArticle(mention.url);
              }}
              accessibilityRole="button"
              accessibilityLabel={articleSaved ? 'Remove from Saved Articles' : 'Add to Saved Articles'}>
              <Ionicons
                name={articleSaved ? 'file-tray-full' : 'file-tray-full-outline'}
                size={20}
                color={articleSaved ? accentColor : cardPalette.text}
              />
              <Text style={styles.sheetRowText}>
                {articleSaved ? 'Remove from Saved Articles' : 'Add to Saved Articles'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                Share.share({
                  message: `${mention.post}\n\n${mention.url}`,
                  url: mention.url,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Share mention">
              <Ionicons name="share-social-outline" size={20} color={cardPalette.text} />
              <Text style={styles.sheetRowText}>Share</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                emailArticle();
              }}
              accessibilityRole="button"
              accessibilityLabel="Email article">
              <Ionicons name="mail-outline" size={20} color={cardPalette.text} />
              <Text style={styles.sheetRowText}>Email Article</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                Alert.alert('Download started', 'This mention would be saved to your device.');
              }}
              accessibilityRole="button"
              accessibilityLabel="Download">
              <Ionicons name="download-outline" size={20} color={cardPalette.text} />
              <Text style={styles.sheetRowText}>Download</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                setDetailsVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="View article details">
              <Ionicons name="document-text-outline" size={20} color={cardPalette.text} />
              <Text style={styles.sheetRowText}>View Article Details</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <MentionDetailsModal
        visible={detailsVisible}
        mention={mention}
        engagementItems={engagementItems}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}

function MentionDetailsModal({
  visible,
  mention,
  engagementItems,
  onClose,
}: {
  visible: boolean;
  mention: SocialMention;
  engagementItems: { icon: IoniconName; label: string; count: number }[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.detailsScreen}>
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Mention Details</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.detailsCloseButton}>
            <Ionicons name="close" size={18} color={cardPalette.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.detailsBody} showsVerticalScrollIndicator={false}>
          <View style={styles.sourceRow}>
            <AuthorAvatar handle={mention.handle} platform={mention.platform} size={40} />
            <View style={styles.identityColumn}>
              <View style={styles.nameLine}>
                <Text style={styles.handle}>{mention.handle}</Text>
                <View style={[styles.sentimentDot, { backgroundColor: SENTIMENT_DOT[mention.sentiment] }]} />
              </View>
              <Text style={styles.ago}>{mention.ago}</Text>
            </View>
          </View>

          <Text style={styles.detailsPostText}>{mention.post}</Text>

          {mention.thumb && (
            <View style={styles.detailsThumb}>
              <Image source={mention.thumb} style={styles.thumbImage} resizeMode="cover" />
            </View>
          )}

          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionLabel}>Engagement</Text>
            <View style={styles.detailsStatGrid}>
              {engagementItems.map((item) => (
                <View key={item.label} style={styles.detailsStat}>
                  <Ionicons name={item.icon} size={18} color={cardPalette.textSecondary} />
                  <Text style={styles.detailsStatCount}>{item.count.toLocaleString()}</Text>
                  <Text style={styles.detailsStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailsSectionLabel}>Capture Info</Text>
            <Text style={styles.detailsMeta}>Posted {mention.date}</Text>
            <Text style={styles.detailsMeta}>Metrics as of {formatCapturedAsOf(mention.capturedAt)} UTC</Text>
            <Text style={styles.detailsMeta} numberOfLines={1}>
              {mention.url}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    backgroundColor: cardPalette.track,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  identityColumn: {
    flex: 1,
    gap: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Spacing.two,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: cardPalette.text,
  },
  sentimentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ago: {
    fontSize: 11,
    color: cardPalette.textSecondary,
  },
  postText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    color: cardPalette.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  engagementRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    flexShrink: 1,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '600',
    color: cardPalette.textSecondary,
  },
  pressed: {
    opacity: 0.5,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
  },
  sheet: {
    backgroundColor: cardPalette.card,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: cardPalette.border,
    marginBottom: Spacing.two,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: cardPalette.text,
  },
  detailsScreen: {
    flex: 1,
    backgroundColor: cardPalette.card,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: cardPalette.text,
  },
  detailsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: cardPalette.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBody: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  detailsPostText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: cardPalette.text,
  },
  detailsThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    backgroundColor: cardPalette.track,
    overflow: 'hidden',
  },
  detailsSection: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: cardPalette.border,
  },
  detailsSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: cardPalette.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.one,
  },
  detailsStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  detailsStat: {
    alignItems: 'center',
    gap: 2,
  },
  detailsStatCount: {
    fontSize: 16,
    fontWeight: '700',
    color: cardPalette.text,
  },
  detailsStatLabel: {
    fontSize: 11,
    color: cardPalette.textSecondary,
  },
  detailsMeta: {
    fontSize: 13,
    color: cardPalette.textSecondary,
  },
});
