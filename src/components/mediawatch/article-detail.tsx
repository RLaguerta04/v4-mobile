// MediaWatch article detail — the article analogue of mention-card's
// MentionDetailsModal. Reuses the shared detail primitives (DetailCard,
// StatTiles, TriSelector, Keyword/Entity pills) so it matches the social
// detail visually, but is driven entirely by a NewsArticle.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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

import {
  BRAND_OPTIONS,
  DetailCard,
  EntityPills,
  KeywordPills,
  StatTiles,
  TONE_OPTIONS,
  TriSelector,
  cardPalette,
} from '@/components/detail-primitives';
import { MEDIA_TYPE_META, MediaTypeIcon, SentimentPill } from '@/components/mediawatch/article-ui';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SaveToFolderSheet } from '@/components/save-to-folder-sheet';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { formatAve } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';

const SHEET_OFFSCREEN_Y = 400;

// A tiny coverage-volume sparkline rendered with plain Views (web parity: the
// detail chart's daily bars). No svg needed for this stacked mini-bar look.
function CoverageSparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <View style={styles.sparkRow}>
      {data.map((v, i) => (
        <View key={i} style={styles.sparkCol}>
          <View style={[styles.sparkBar, { height: `${Math.max(6, (v / max) * 100)}%` }]} />
        </View>
      ))}
    </View>
  );
}

// Deterministic, offline "AI" read of the article — mirrors the web's simulated
// summarize (gist of the story + a read of the coverage angle). No backend.
function buildArticleSummary(a: NewsArticle): { gist: string; read: string } {
  const toneWord =
    a.tone === 'positive' ? 'favourable' : a.tone === 'negative' ? 'critical' : 'balanced';
  const gist =
    a.summary ??
    `${a.outlet} reports on ${a.title.toLowerCase()} in its ${a.section} section.`;
  const read = `This ${MEDIA_TYPE_META[a.mediaType].label} pickup from ${a.outlet} carries a ${toneWord} tone and a Story Value of ${a.storyValue.toFixed(
    1,
  )} (${formatAve(a.ave)} AVE). Brand sentiment reads ${a.sentiment}. Key entities: ${a.entities
    .slice(0, 3)
    .join(', ')}.`;
  return { gist, read };
}

export function ArticleDetailModal({
  visible,
  article,
  onClose,
}: {
  visible: boolean;
  article: NewsArticle;
  onClose: () => void;
}) {
  const { accentColor } = useAuth();
  const { isSaved, toggleSave } = useBookmarks();
  const { isArticleSaved } = useSavedArticles();
  const saved = isSaved(article.url);
  const tracked = isArticleSaved(article.url);

  const [menuOpen, setMenuOpen] = useState(false);
  const [savePickerOpen, setSavePickerOpen] = useState(false);
  const [menuBackdrop] = useState(() => new Animated.Value(0));
  const [menuTranslateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_Y));

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{ gist: string; read: string } | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const dismiss = useDismissGesture(onClose);

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

  function runSummary() {
    setSummary(null);
    setSummaryLoading(true);
    setTimeout(() => {
      setSummary(buildArticleSummary(article));
      setSummaryLoading(false);
    }, 1100);
  }
  function summarize() {
    setSummaryOpen(true);
    if (!summary && !summaryLoading) runSummary();
  }
  function emailArticle() {
    const subject = encodeURIComponent(article.title);
    const body = encodeURIComponent(`${article.title}\n${article.outlet} · ${article.section}\n\n${article.url}`);
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  const isBroadcast = article.mediaType === 'tv' || article.mediaType === 'radio';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} title="Article Details" />
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={dismiss.onScroll}
            scrollEventThrottle={16}>
            <DetailCard>
              <View style={styles.sourceRow}>
                <MediaTypeIcon type={article.mediaType} size={40} />
                <View style={styles.identity}>
                  <Text style={styles.outlet} numberOfLines={1}>
                    {article.outlet}
                  </Text>
                  <Text style={styles.subMeta} numberOfLines={1}>
                    {article.section} · {article.ago}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="More actions"
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={cardPalette.textSecondary} />
                </Pressable>
              </View>

              {summaryOpen && (
                <View style={styles.summaryPanel}>
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryLabel}>
                      <Ionicons name="sparkles" size={13} color={accentColor} />
                      <Text style={styles.summaryLabelText}>AI Summary</Text>
                    </View>
                    <Pressable
                      onPress={() => setSummaryOpen(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Hide summary"
                      hitSlop={8}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <Ionicons name="close" size={16} color={cardPalette.textSecondary} />
                    </Pressable>
                  </View>
                  {summaryLoading || !summary ? (
                    <View style={styles.summaryLoadingRow}>
                      <ActivityIndicator size="small" color={accentColor} />
                      <Text style={styles.summaryLoadingText}>Reading the article…</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.summarySub}>Gist</Text>
                      <Text style={styles.summaryText}>{summary.gist}</Text>
                      <Text style={styles.summarySub}>Coverage read</Text>
                      <Text style={styles.summaryText}>{summary.read}</Text>
                    </>
                  )}
                </View>
              )}

              <Text style={styles.headline}>{article.title}</Text>
              <View style={styles.pillRow}>
                <SentimentPill sentiment={article.sentiment} />
              </View>
              {article.summary && <Text style={styles.summaryBody}>{article.summary}</Text>}

              {isBroadcast && article.program && (
                <View style={styles.broadcastBox}>
                  <Text style={styles.broadcastMeta}>
                    {article.program}
                    {article.segment ? ` · ${article.segment}` : ''}
                    {article.length ? ` · ${article.length}` : ''}
                  </Text>
                  {article.aired && <Text style={styles.broadcastAired}>Aired {article.aired}</Text>}
                  {article.transcript && (
                    <>
                      <Text
                        style={styles.transcript}
                        numberOfLines={transcriptOpen ? undefined : 3}>
                        {article.transcript}
                      </Text>
                      <Pressable onPress={() => setTranscriptOpen((v) => !v)} accessibilityRole="button">
                        <Text style={[styles.transcriptToggle, { color: accentColor }]}>
                          {transcriptOpen ? 'Show less' : 'Read transcript'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              {article.page && <Text style={styles.pageNote}>Page {article.page}</Text>}

              <Text style={styles.sparkCaption}>Coverage volume (last 9 days)</Text>
              <CoverageSparkline data={article.chart} />
            </DetailCard>

            <DetailCard>
              <StatTiles
                left={{ label: 'Story Value', value: article.storyValue.toFixed(2) }}
                right={{ label: 'AVE', value: formatAve(article.ave) }}
              />
            </DetailCard>

            <DetailCard>
              <MetaRows article={article} />
            </DetailCard>

            <DetailCard label="Author">
              <View style={styles.authorRow}>
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorAvatarText}>{article.author.charAt(0)}</Text>
                </View>
                <View style={styles.authorIdentity}>
                  <Text style={styles.authorName}>{article.author}</Text>
                  <Text style={styles.authorOutlet}>{article.outlet}</Text>
                </View>
                <View style={styles.authorScoreBox}>
                  <Text style={styles.authorScoreLabel}>Author Score</Text>
                  <Text style={styles.authorScoreVal}>{article.authorScore?.toFixed(2) ?? '—'}</Text>
                </View>
              </View>
            </DetailCard>

            <DetailCard label="Brand Sentiment">
              <TriSelector options={BRAND_OPTIONS} initial={article.sentiment} />
            </DetailCard>

            <DetailCard label="Article Tone">
              <TriSelector options={TONE_OPTIONS} initial={article.tone} />
            </DetailCard>

            {article.keywords.length > 0 && (
              <DetailCard label="Keywords">
                <KeywordPills keywords={article.keywords} />
              </DetailCard>
            )}

            {article.entities.length > 0 && (
              <DetailCard label="Entities">
                <EntityPills entities={article.entities} />
              </DetailCard>
            )}

            <DetailCard label="Capture Info">
              <Text style={styles.metaDim}>Published {article.date}</Text>
              <Text style={styles.metaDim} numberOfLines={1}>
                {article.url}
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
              <SheetAction icon="sparkles-outline" label="Summarize" onPress={() => { closeActionMenu(); summarize(); }} />
              <SheetAction
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                label={saved ? 'Remove bookmark' : 'Bookmark article'}
                color={saved ? accentColor : undefined}
                onPress={() => { closeActionMenu(); toggleSave(article.url); }}
              />
              <SheetAction
                icon={tracked ? 'file-tray-full' : 'file-tray-full-outline'}
                label={tracked ? 'Move to folder' : 'Add to Saved Articles'}
                color={tracked ? accentColor : undefined}
                onPress={() => { closeActionMenu(); setSavePickerOpen(true); }}
              />
              <SheetAction
                icon="share-social-outline"
                label="Share"
                onPress={() => { closeActionMenu(); Share.share({ message: `${article.title}\n\n${article.url}`, url: article.url }); }}
              />
              <SheetAction icon="mail-outline" label="Email Article" onPress={() => { closeActionMenu(); emailArticle(); }} />
              <SheetAction icon="open-outline" label="View Original" onPress={() => { closeActionMenu(); Linking.openURL(article.url); }} />
              <SheetAction
                icon="download-outline"
                label="Export as PDF"
                onPress={() => { closeActionMenu(); Alert.alert('Export started', 'This article would be exported as a PDF to your device.'); }}
              />
            </Animated.View>
          </View>
        )}

        <SaveToFolderSheet
          host="inline"
          visible={savePickerOpen}
          url={article.url}
          onClose={() => setSavePickerOpen(false)}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

function SheetAction({
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

function MetaRows({ article }: { article: NewsArticle }) {
  const rows: { k: string; v: string }[] = [
    { k: 'Outlet', v: article.outlet },
    { k: 'Section', v: article.section },
    { k: 'Author', v: article.author },
    { k: 'Media Type', v: MEDIA_TYPE_META[article.mediaType].label },
    { k: 'AVE', v: formatAve(article.ave) },
    { k: 'Published', v: article.date },
  ];
  if (article.page) rows.push({ k: 'Page', v: article.page });
  return (
    <View style={styles.metaList}>
      {rows.map((r) => (
        <View key={r.k} style={styles.metaRow}>
          <Text style={styles.metaKey}>{r.k}</Text>
          <Text style={styles.metaVal}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF8F4' },
  fill: { flex: 1 },
  body: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  identity: { flex: 1, gap: 2 },
  outlet: { fontSize: 15, fontWeight: '700', color: cardPalette.text },
  subMeta: { fontSize: 12, color: cardPalette.textSecondary },
  headline: { fontSize: 20, fontWeight: '700', lineHeight: 27, color: cardPalette.text },
  pillRow: { flexDirection: 'row' },
  summaryBody: { fontSize: 15, lineHeight: 22, color: cardPalette.text },
  broadcastBox: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1,
    borderColor: cardPalette.border,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: 4,
  },
  broadcastMeta: { fontSize: 13, fontWeight: '600', color: cardPalette.text },
  broadcastAired: { fontSize: 12, color: cardPalette.textSecondary },
  transcript: { fontSize: 13, lineHeight: 19, color: cardPalette.text, marginTop: 4 },
  transcriptToggle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pageNote: { fontSize: 12, color: cardPalette.textSecondary },
  sparkCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: cardPalette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.one,
  },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 48 },
  sparkCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  sparkBar: { width: '100%', borderRadius: 3, backgroundColor: '#B9A4F7' },

  metaList: { gap: Spacing.two },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  metaKey: { fontSize: 13, color: cardPalette.textSecondary },
  metaVal: { fontSize: 13, fontWeight: '600', color: cardPalette.text, flexShrink: 1, textAlign: 'right' },
  metaDim: { fontSize: 13, color: cardPalette.textSecondary },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E94F37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  authorIdentity: { flex: 1 },
  authorName: { fontSize: 15, fontWeight: '600', color: cardPalette.text },
  authorOutlet: { fontSize: 12, color: cardPalette.textSecondary },
  authorScoreBox: { alignItems: 'flex-end' },
  authorScoreLabel: { fontSize: 10, color: cardPalette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  authorScoreVal: { fontSize: 18, fontWeight: '700', color: cardPalette.text },

  summaryPanel: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1,
    borderColor: cardPalette.border,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: 6,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: cardPalette.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summaryLoadingText: { fontSize: 13, color: cardPalette.textSecondary },
  summarySub: {
    fontSize: 11,
    fontWeight: '700',
    color: cardPalette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  summaryText: { fontSize: 13, lineHeight: 19, color: cardPalette.text },

  pressed: { opacity: 0.5 },
  actionSheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
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
