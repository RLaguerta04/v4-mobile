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
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-avatar';
import {
  BRAND_OPTIONS,
  DetailCard,
  EntityPills,
  KeywordPills,
  SENTIMENT_DOT,
  StatTiles,
  TONE_OPTIONS,
  TriSelector,
  cardPalette,
  formatCount,
} from '@/components/detail-primitives';
import { AddToTrackerSheet } from '@/components/mediawatch/add-to-tracker-sheet';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SaveToFolderSheet } from '@/components/save-to-folder-sheet';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { useSocialTracker } from '@/contexts/social-tracker-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { SocialMention, TrackerMatch } from '@/data/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Re-exported for existing importers that pulled these from mention-card.
export { cardPalette, SENTIMENT_DOT, formatCount };

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
        { icon: 'thumbs-up-outline', label: 'Reactions', count: mention.engagement.likes },
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

export function MentionCard({
  mention,
  saved,
  onToggleSave,
  matchScore,
}: {
  mention: SocialMention;
  saved: boolean;
  onToggleSave: () => void;
  // Web-client parity: the coverage table's MATCH column. Only rendered when
  // provided — the Home feed omits it.
  matchScore?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const accentColor = useAccentColor();
  const { isArticleSaved } = useSavedArticles();
  const articleSaved = isArticleSaved(mention.url);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;
  const engagementItems = getEngagementItems(mention);
  // Estimated reach / engagement score surfaced inline on the card's meta row.
  // Both are optional, so the strip only renders when at least one is present.
  const hasInsights = mention.estReach !== undefined || mention.engScore !== undefined;

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
    // The ··· menu is a sibling overlay — not nested inside the tappable card
    // Pressable — so the two don't form a <button>-in-<button> on web and a tap
    // on ··· never bubbles up to open the details view.
    <View style={styles.cardContainer}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setDetailsVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Open details for the mention from ${mention.handle}`}>
        <View style={[styles.sourceRow, styles.cardSourceRow]}>
        <AuthorAvatar handle={mention.handle} platform={mention.platform} size={36} />
        <View style={styles.identityColumn}>
          <View style={styles.nameLine}>
            <Text style={styles.handle} numberOfLines={1}>
              {mention.handle}
            </Text>
            <View style={[styles.sentimentDot, { backgroundColor: SENTIMENT_DOT[mention.sentiment] }]} />
          </View>
          <Text style={styles.ago} numberOfLines={1}>
            {mention.ago} · <Ionicons name="time-outline" size={11} color={theme.textSecondary} /> As
            of {formatCapturedAsOf(mention.capturedAt)} · UTC
          </Text>
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
              <Ionicons name={item.icon} size={15} color={theme.textSecondary} />
              <Text style={styles.engagementText}>{formatCount(item.count)}</Text>
            </View>
          ))}
        </View>
        {(hasInsights || matchScore !== undefined) && (
          <View style={styles.metaRight}>
            {hasInsights && (
              <View style={styles.insightsRow}>
                {mention.estReach !== undefined && (
                  <View style={styles.insightItem}>
                    <Ionicons name="megaphone-outline" size={13} color={theme.textSecondary} />
                    <Text style={styles.insightText}>{mention.estReach}</Text>
                  </View>
                )}
                {mention.engScore !== undefined && (
                  <View style={styles.insightItem}>
                    <Ionicons name="flash-outline" size={13} color={theme.textSecondary} />
                    <Text style={styles.insightText}>{mention.engScore}</Text>
                  </View>
                )}
              </View>
            )}
            {matchScore !== undefined && (
              <View style={styles.matchBlock}>
                <Text style={[styles.matchText, matchScore < 85 && styles.matchTextMid]}>
                  {matchScore}% match
                </Text>
                <View style={styles.matchTrack}>
                  <View
                    style={[
                      styles.matchFill,
                      matchScore < 85 && styles.matchFillMid,
                      { width: `${matchScore}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}
        </View>
      </Pressable>

      <Pressable
        hitSlop={8}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [styles.cardMenuButton, pressed && styles.pressed]}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
      </Pressable>

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
                color={saved ? accentColor : theme.text}
              />
              <Text style={styles.sheetRowText}>{saved ? 'Remove bookmark' : 'Save mention'}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
              onPress={() => {
                closeMenu();
                setSaveSheetOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={articleSaved ? 'Move to folder' : 'Add to Saved Articles'}>
              <Ionicons
                name={articleSaved ? 'file-tray-full' : 'file-tray-full-outline'}
                size={20}
                color={articleSaved ? accentColor : theme.text}
              />
              <Text style={styles.sheetRowText}>
                {articleSaved ? 'Move to folder' : 'Add to Saved Articles'}
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
              <Ionicons name="share-social-outline" size={20} color={theme.text} />
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
              <Ionicons name="mail-outline" size={20} color={theme.text} />
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
              <Ionicons name="download-outline" size={20} color={theme.text} />
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
              <Ionicons name="document-text-outline" size={20} color={theme.text} />
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

      <SaveToFolderSheet
        visible={saveSheetOpen}
        url={mention.url}
        onClose={() => setSaveSheetOpen(false)}
      />
    </View>
  );
}

// Source label per platform for the "Source" meta row — the social-context
// stand-in for the web client's "Publisher" field.
const PLATFORM_LABEL: Record<SocialMention['platform'], string> = {
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  reddit: 'Reddit',
};

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
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accentColor = useAccentColor();
  const { isArticleSaved } = useSavedArticles();
  const tracked = isArticleSaved(mention.url);

  // Tracker parity with MediaWatch's article detail. A social post has no
  // article shape, so it's represented as a match keyed on its post text, with
  // the handle as source and no media channel/value (social isn't a TrackerMedia).
  const { activities, countMatches, toggleMatch, createActivityWithMatch } = useSocialTracker();
  const trackedCount = countMatches(mention.post);
  const trackerMatch: TrackerMatch = {
    source: mention.handle,
    media: 'Online',
    title: mention.post,
    date: mention.date,
    value: 0,
    score: 1,
  };
  const [trackerSheetOpen, setTrackerSheetOpen] = useState(false);

  // Actions bottom sheet (opened by the ··· button on the post card) — the
  // labeled icon+name menu, same slide-up/backdrop-fade pattern as the feed
  // card's options sheet. Rendered as an in-tree overlay (not a nested Modal).
  const [menuOpen, setMenuOpen] = useState(false);
  // Save-to-folder picker, also in-tree (this detail screen is already a Modal).
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [menuBackdrop] = useState(() => new Animated.Value(0));
  const [menuTranslateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_Y));

  function closeActionMenu() {
    Animated.parallel([
      Animated.timing(menuBackdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(menuTranslateY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setMenuOpen(false));
  }

  useEffect(() => {
    if (!menuOpen) return;
    menuBackdrop.setValue(0);
    menuTranslateY.setValue(SHEET_OFFSCREEN_Y);
    Animated.parallel([
      Animated.timing(menuBackdrop, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(menuTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuOpen, menuBackdrop, menuTranslateY]);

  function emailPost() {
    const subject = encodeURIComponent(`Mention from ${mention.handle}`);
    const body = encodeURIComponent(`${mention.post}\n\n${mention.url}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }
  const dismiss = useDismissGesture(onClose);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.detailsScreen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} title="Post Details" />
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.detailsBody}
            showsVerticalScrollIndicator={false}
            onScroll={dismiss.onScroll}
            scrollEventThrottle={16}>
          <DetailCard>
            <View style={styles.sourceRow}>
              <AuthorAvatar handle={mention.handle} platform={mention.platform} size={40} />
              <View style={styles.identityColumn}>
                <View style={styles.nameLine}>
                  <Text style={styles.handle}>{mention.handle}</Text>
                  <Ionicons name="checkmark-circle" size={14} color={theme.info} />
                </View>
                <Text style={styles.ago}>
                  {PLATFORM_LABEL[mention.platform]} · {mention.ago}
                </Text>
              </View>

              <Pressable
                onPress={() => setMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="More actions"
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.detailsPostText}>{mention.post}</Text>

            <View style={styles.trackerRow}>
              <Pressable
                onPress={() => setTrackerSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={trackedCount > 0 ? `In tracker, ${trackedCount} activities` : 'Add to tracker'}
                style={[
                  styles.trackerPill,
                  trackedCount > 0 && { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}44` },
                ]}>
                <Ionicons
                  name={trackedCount > 0 ? 'folder-open' : 'folder-outline'}
                  size={13}
                  color={trackedCount > 0 ? accentColor : theme.textSecondary}
                />
                <Text style={[styles.trackerPillText, trackedCount > 0 && { color: accentColor }]}>
                  {trackedCount > 0 ? `In Tracker · ${trackedCount}` : 'Add to Tracker'}
                </Text>
              </Pressable>
            </View>

            {mention.thumb && (
              <View style={styles.detailsThumb}>
                <Image source={mention.thumb} style={styles.thumbImage} resizeMode="cover" />
                <Text style={styles.thumbCredit}>{PLATFORM_LABEL[mention.platform].toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.postStatsRow}>
              {engagementItems.map((item) => (
                <View key={item.label} style={styles.postStat}>
                  <Ionicons name={item.icon} size={16} color={theme.textSecondary} />
                  <Text style={styles.postStatCount}>{formatCount(item.count)}</Text>
                  <Text style={styles.postStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <CommentsList seed={mention.url} />
          </DetailCard>

          {(mention.estReach !== undefined || mention.engScore !== undefined) && (
            <DetailCard>
              <StatTiles
                left={{ label: 'Estimated Reach', value: mention.estReach ?? '—' }}
                right={{ label: 'Engagement Score', value: mention.engScore ?? '—' }}
              />
              <View style={styles.tilesCaption}>
                <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                <Text style={styles.detailsMeta}>
                  As of {formatCapturedAsOf(mention.capturedAt)} · UTC
                </Text>
              </View>
            </DetailCard>
          )}

          <DetailCard>
            <MetaRows mention={mention} />
          </DetailCard>

          {mention.author && (
            <DetailCard label="Influencer">
              <View style={styles.authorRow}>
                <AuthorAvatar handle={mention.handle} platform={mention.platform} size={32} />
                <View style={styles.influencerIdentity}>
                  <Text style={styles.authorName}>{mention.author}</Text>
                  <Text style={styles.influencerPlatform}>{PLATFORM_LABEL[mention.platform]}</Text>
                </View>
              </View>
              <View style={styles.authorStats}>
                <View style={styles.authorStat}>
                  <Text style={styles.detailsStatLabel}>Influencer Score</Text>
                  <Text style={styles.authorStatVal}>{mention.influencerScore ?? '—'}</Text>
                </View>
                <View style={styles.authorStat}>
                  <Text style={styles.detailsStatLabel}>Followers</Text>
                  <Text style={styles.authorStatVal}>{mention.followers ?? '—'}</Text>
                </View>
              </View>
            </DetailCard>
          )}

          <DetailCard label="Brand Sentiment">
            <TriSelector options={BRAND_OPTIONS} initial={mention.sentiment} />
          </DetailCard>

          {mention.tone && (
            <DetailCard label="Post Tone">
              <TriSelector options={TONE_OPTIONS} initial={mention.tone} />
            </DetailCard>
          )}

          {mention.keywords && mention.keywords.length > 0 && (
            <DetailCard label="Keywords">
              <KeywordPills keywords={mention.keywords} />
            </DetailCard>
          )}

          {mention.entities.length > 0 && (
            <DetailCard label="Entities">
              <EntityPills entities={mention.entities} />
            </DetailCard>
          )}

          <DetailCard label="Capture Info">
            <Text style={styles.detailsMeta}>Posted {mention.date}</Text>
            <Text style={styles.detailsMeta}>Metrics as of {formatCapturedAsOf(mention.capturedAt)} UTC</Text>
            <Text style={styles.detailsMeta} numberOfLines={1}>
              {mention.url}
            </Text>
          </DetailCard>
          </ScrollView>
        </Animated.View>

        {menuOpen && (
          <View style={styles.actionSheetOverlay}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: menuBackdrop }]}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeActionMenu}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              />
            </Animated.View>

            <Animated.View style={[styles.sheet, { transform: [{ translateY: menuTranslateY }] }]}>
              <View style={styles.sheetHandle} />

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                onPress={() => {
                  closeActionMenu();
                  emailPost();
                }}
                accessibilityRole="button"
                accessibilityLabel="Send via email">
                <Ionicons name="mail-outline" size={20} color={theme.text} />
                <Text style={styles.sheetRowText}>Send via Email</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                onPress={() => {
                  closeActionMenu();
                  Alert.alert('Export started', 'This post would be exported as a PDF to your device.');
                }}
                accessibilityRole="button"
                accessibilityLabel="Export as PDF">
                <Ionicons name="download-outline" size={20} color={theme.text} />
                <Text style={styles.sheetRowText}>Export as PDF</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                onPress={() => {
                  closeActionMenu();
                  Linking.openURL(mention.url);
                }}
                accessibilityRole="button"
                accessibilityLabel="View post">
                <Ionicons name="open-outline" size={20} color={theme.text} />
                <Text style={styles.sheetRowText}>View Post</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                onPress={() => {
                  closeActionMenu();
                  setSavePickerOpen(true);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: tracked }}
                accessibilityLabel={tracked ? 'Move to folder' : 'Add to Saved Articles'}>
                <Ionicons
                  name={tracked ? 'file-tray-full' : 'file-tray-full-outline'}
                  size={20}
                  color={tracked ? accentColor : theme.text}
                />
                <Text style={[styles.sheetRowText, tracked && { color: accentColor }]}>
                  {tracked ? 'Move to folder' : 'Add to Saved Articles'}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}

        <SaveToFolderSheet
          host="inline"
          visible={savePickerOpen}
          url={mention.url}
          onClose={() => setSavePickerOpen(false)}
        />

        <AddToTrackerSheet
          visible={trackerSheetOpen}
          match={trackerMatch}
          activities={activities}
          toggleMatch={toggleMatch}
          createActivityWithMatch={createActivityWithMatch}
          onClose={() => setTrackerSheetOpen(false)}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Article-detail primitives (single-column, stacked) ──

// Key/value meta rows (Platform, Type, Influencer, Est. Reach, Posted).
function MetaRows({ mention }: { mention: SocialMention }) {
  const styles = useThemedStyles(makeStyles);
  const rows: { k: string; v: string; sub?: string }[] = [];
  rows.push({ k: 'Platform', v: PLATFORM_LABEL[mention.platform] });
  if (mention.type) rows.push({ k: 'Type', v: mention.type });
  rows.push({ k: 'Influencer', v: mention.author ?? mention.handle });
  if (mention.estReach) rows.push({ k: 'Est. Reach', v: mention.estReach });
  rows.push({ k: 'Posted', v: mention.date, sub: mention.ago });

  return (
    <View style={styles.metaList}>
      {rows.map((r) => (
        <View key={r.k} style={styles.detailMetaRow}>
          <Text style={styles.metaKey}>{r.k}</Text>
          <View style={styles.metaValueWrap}>
            <Text style={styles.metaValue}>{r.v}</Text>
            {r.sub && <Text style={styles.metaValueSub}>{r.sub}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// Deterministic social comments — a shared EV/car-themed PH pool, picked per
// post (seeded from its URL) so the thread stays stable across renders without
// authoring comments on every record. Mirrors the web client's _socComments.
const SOCIAL_COMMENTS: { author: string; text: string }[] = [
  { author: 'Maria Santos', text: 'Finally test drove one — super smooth 🙌' },
  { author: 'Juan dela Cruz', text: 'Available na ba sa province?' },
  { author: 'Anna Reyes', text: "How's the charging network sa area niyo?" },
  { author: 'Paolo Mendoza', text: 'Switched to EV last month, no regrets.' },
  { author: 'Grace Lim', text: 'Ang ganda ng interior, honestly 🔥' },
  { author: 'Marco Villanueva', text: 'Solid value for the price.' },
  { author: 'Bea Cruz', text: 'Battery life after 1 year, kumusta?' },
  { author: 'Nathan Ong', text: 'Good value for the price, honestly.' },
  { author: 'Isabel Garcia', text: 'Sana all may ganito 😅' },
  { author: 'Kevin Tan', text: 'Any promo for first-time buyers?' },
  { author: 'Liza Ramos', text: 'Nice! Sharing this with the fam.' },
  { author: 'Diego Flores', text: 'Service center experience needs work though.' },
  { author: 'Camille Aquino', text: 'Waiting for this model in our area 🙏' },
  { author: 'Rafael Bautista', text: 'Test unit felt premium, ngl.' },
  { author: 'Trina Gomez', text: 'How much yung monthly if financed?' },
  { author: 'Miguel Torres', text: 'Range is legit for city driving.' },
];

const COMMENT_COLORS = ['#1877F2', '#16A34A', '#E4405F', '#F97316', '#8B5CF6', '#0891B2', '#DB2777', '#D97706'];
const COMMENT_TIMES = ['1h', '2h', '3h', '5h', '7h', '9h', '12h', '15h', '18h', '1d', '2d'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type SocialComment = { author: string; text: string; time: string; likes: number };

function buildComments(seed: string): SocialComment[] {
  const h = hashString(seed);
  const n = 5 + (h % 3); // 5–7 comments
  const out: SocialComment[] = [];
  for (let i = 0; i < n; i++) {
    const c = SOCIAL_COMMENTS[(h + i * 7) % SOCIAL_COMMENTS.length];
    const hh = (h + i * 2654435761) >>> 0;
    out.push({ author: c.author, text: c.text, time: COMMENT_TIMES[hh % COMMENT_TIMES.length], likes: (hh >>> 6) % 38 });
  }
  return out;
}

// Comments thread for the post card: first 3 shown, rest behind "View all N".
function CommentsList({ seed }: { seed: string }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const comments = buildComments(seed);
  const [expanded, setExpanded] = useState(false);
  const limit = 3;
  const shown = expanded ? comments : comments.slice(0, limit);
  const remaining = comments.length - limit;

  return (
    <View style={styles.commentsSection}>
      {shown.map((c, i) => (
        <View key={i} style={styles.commentRow}>
          <View style={[styles.commentAvatar, { backgroundColor: COMMENT_COLORS[hashString(c.author) % COMMENT_COLORS.length] }]}>
            <Text style={styles.commentAvatarText}>{c.author.charAt(0)}</Text>
          </View>
          <View style={styles.commentBody}>
            <Text style={styles.commentMeta}>
              <Text style={styles.commentAuthor}>{c.author}</Text>
              <Text style={styles.commentTime}> · {c.time}</Text>
            </Text>
            <Text style={styles.commentText}>{c.text}</Text>
            <View style={styles.commentLike}>
              <Ionicons name="heart-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.commentLikeCount}>{c.likes}</Text>
            </View>
          </View>
        </View>
      ))}
      {!expanded && remaining > 0 && (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.commentsMore}>View all {comments.length} comments</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  cardContainer: {
    position: 'relative',
  },
  card: {
    gap: Spacing.two,
  },
  cardPressed: {
    opacity: 0.7,
  },
  // Reserve space at the source row's right edge so the handle/timestamp never
  // runs under the absolutely-positioned ··· overlay button.
  cardSourceRow: {
    paddingRight: 32,
  },
  // The ··· menu, overlaid at the card's top-right as a sibling of the tappable
  // Pressable (see MentionCard's render) — vertically centered on the 36px avatar.
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
    backgroundColor: theme.track,
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
    color: theme.text,
  },
  sentimentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ago: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  postText: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 23,
    color: theme.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  // Right side of the meta row. Holds the estimated-reach / engagement-score
  // strip and, in Brief/coverage contexts, the match block stacked beneath it.
  metaRight: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  insightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  matchBlock: {
    alignItems: 'flex-end',
    gap: 3,
  },
  // Green ≥85%, amber below — the web coverage table's MATCH thresholds.
  matchText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.positive,
  },
  matchTextMid: {
    color: theme.warning,
  },
  matchTrack: {
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.track,
  },
  matchFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.positive,
  },
  matchFillMid: {
    backgroundColor: theme.warning,
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
    color: theme.textSecondary,
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
    backgroundColor: theme.scrim,
  },
  sheet: {
    backgroundColor: theme.card,
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
    backgroundColor: theme.border,
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
    color: theme.text,
  },
  detailsScreen: {
    flex: 1,
    backgroundColor: theme.surfaceWarm,
  },
  fill: {
    flex: 1,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  detailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  detailsBackButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBody: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  detailsPostText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: theme.text,
  },

  // "Add to Tracker" pill under the post text — mirrors the MediaWatch article
  // detail's trackerPill. Wrapped in a row so the pill hugs its content width.
  trackerRow: {
    flexDirection: 'row',
  },
  trackerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  trackerPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  // Post-card actions bottom sheet (opened by ···) — overlays the detail modal.
  actionSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },

  detailsThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    backgroundColor: theme.track,
    overflow: 'hidden',
  },
  // Platform credit overlaid on the post image (e.g. "FACEBOOK"), bottom-right.
  thumbCredit: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Post engagement stats row (Reactions · Comments · Shares) inside the card.
  postStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postStatCount: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  postStatLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },

  // Comments thread
  commentsSection: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  commentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: {
    fontSize: 13,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  commentTime: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.text,
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  commentLikeCount: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  commentsMore: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  detailsSection: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  detailsSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
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
    color: theme.text,
  },
  detailsStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  detailsMeta: {
    fontSize: 13,
    color: theme.textSecondary,
  },

  // ── Article-detail cards ──
  tilesCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.two,
  },

  // Meta rows
  metaList: {
    gap: Spacing.two,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  metaKey: {
    fontSize: 13,
    color: theme.textSecondary,
    flexShrink: 0,
  },
  metaValueWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'right',
  },
  metaValueSub: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },

  // Influencer card
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  influencerIdentity: {
    flexShrink: 1,
    gap: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    flexShrink: 1,
  },
  influencerPlatform: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  authorStats: {
    flexDirection: 'row',
    gap: Spacing.six,
    marginTop: Spacing.one,
  },
  authorStat: {
    gap: 2,
  },
  authorStatVal: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },

});
