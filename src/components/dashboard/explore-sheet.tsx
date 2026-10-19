// Explore drill-down (spec §10) — the mobile stand-in for the web's full-page
// "Explore Data" views. A slide-up modal with an "Overview / <title>"
// breadcrumb, an optional chart header slot, and the underlying posts as the
// shared MentionCard list. Phase 3 fills the header slot per drill-down.
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Animated, FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { MentionCard } from '@/components/mention-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useTheme } from '@/contexts/theme-context';
import { Spacing, Theme } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { SocialMention } from '@/data/types';

// The view's posts as shareable text — title + each post's handle · date, the
// post body, its key metrics, and a link. Fed to the OS share sheet by Export.
function exportText(title: string, mentions: SocialMention[]): string {
  const lines: string[] = [title, `${mentions.length} ${mentions.length === 1 ? 'post' : 'posts'}`, ''];
  mentions.forEach((m) => {
    lines.push(`${m.handle} · ${m.date}`);
    lines.push(m.post);
    const meta = [m.estReach ? `Reach ${m.estReach}` : null, m.engScore != null ? `Eng ${m.engScore}` : null]
      .filter(Boolean)
      .join(' · ');
    if (meta) lines.push(meta);
    if (m.url) lines.push(m.url);
    lines.push('');
  });
  return lines.join('\n').trim();
}

export function ExploreSheet({
  visible,
  title,
  mentions,
  header,
  overview,
  onClose,
}: {
  visible: boolean;
  title: string;
  mentions: SocialMention[];
  header?: ReactNode;
  // Breadcrumb root label (defaults to "Overview"); a second-level drill-down
  // passes its parent drill-down's title here.
  overview?: string;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isSaved, toggleSave } = useBookmarks();
  const dismiss = useDismissGesture(onClose);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader
                onClose={onClose}
                breadcrumb={{ current: title, overview }}
                rightActions={
                  mentions.length > 0 ? (
                    <Pressable
                      onPress={() => Share.share({ message: exportText(title, mentions) }).catch(() => {})}
                      accessibilityRole="button"
                      accessibilityLabel="Export posts"
                      hitSlop={8}
                      style={({ pressed }) => [styles.exportPill, pressed && styles.pressed]}>
                      <Ionicons name="share-outline" size={14} color={theme.card} />
                      <Text style={styles.exportPillText}>Export</Text>
                    </Pressable>
                  ) : undefined
                }
              />
            </View>
          </GestureDetector>

          <FlatList
            data={mentions}
            keyExtractor={(m) => m.url}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={dismiss.onScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={
              <View style={styles.headerSlot}>
                {header}
                {mentions.length > 0 ? (
                  <Text style={styles.postsLabel}>
                    {mentions.length} {mentions.length === 1 ? 'post' : 'posts'}
                  </Text>
                ) : null}
              </View>
            }
            renderItem={({ item }) => (
              <MentionCard mention={item} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
            ListEmptyComponent={<Text style={styles.empty}>No posts in this view.</Text>}
          />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  fill: {
    flex: 1,
  },
  body: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  headerSlot: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  postsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // Inverted primary pill: ink fill + card-colored glyph/text in light, a light
  // pill with dark content in dark (see RangeToggle in chart-card).
  exportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: t.text,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.card,
  },
  empty: {
    textAlign: 'center',
    color: t.textSecondary,
    paddingTop: Spacing.six,
  },
  pressed: {
    opacity: 0.6,
  },
});
