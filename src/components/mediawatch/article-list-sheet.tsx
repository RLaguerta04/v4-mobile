// Explore drill-down sheet — lists a set of articles with the web table
// toolbar: a sort control, a Table/Card view toggle, and Export. Card view
// shows ArticleCards; Table view shows the web's wide .tbl (Story Value · AVE ·
// Headline · Outlet · Sentiment · Date) in a horizontal scroller. Pull-to-
// dismiss, same shell as the other MediaWatch sheets.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { SENTIMENT_DOT } from '@/components/detail-primitives';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { ArticleDetailModal } from '@/components/mediawatch/article-detail';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';
import { compactAve } from '@/data/mediawatch-metrics';
import type { ArticleSort } from '@/data/mediawatch-metrics';
import type { NewsArticle } from '@/data/mediawatch-types';

const SORTS: { value: ArticleSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'value-high', label: 'Highest Value' },
  { value: 'value-low', label: 'Lowest Value' },
];

const palette = { text: '#1A1A1A', textSecondary: '#6B7280', border: '#E7DDCC', card: '#FFFFFF', pill: '#F0EEEA' };

function sortArticles(articles: NewsArticle[], sort: ArticleSort): NewsArticle[] {
  const arr = [...articles];
  const t = (a: NewsArticle) => new Date(a.date).getTime();
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => t(b) - t(a));
    case 'oldest':
      return arr.sort((a, b) => t(a) - t(b));
    case 'value-high':
      return arr.sort((a, b) => b.ave - a.ave);
    case 'value-low':
      return arr.sort((a, b) => a.ave - b.ave);
  }
}

export function ArticleListSheet({
  visible,
  title,
  subtitle,
  articles,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  articles: NewsArticle[];
  onClose: () => void;
}) {
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const dismiss = useDismissGesture(onClose);
  const [sort, setSort] = useState<ArticleSort>('newest');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [detail, setDetail] = useState<NewsArticle | null>(null);

  const sorted = useMemo(() => sortArticles(articles, sort), [articles, sort]);

  function exportList() {
    const lines = sorted.map((a) => `• ${a.title} — ${a.outlet} (SV ${a.storyValue.toFixed(2)}, ${compactAve(a.ave)})`);
    Share.share({ message: `${title}\n\n${lines.join('\n')}` }).catch(() => {});
  }

  const toolbar = (
    <View style={styles.toolbar}>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.toolbarRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORTS.map((s) => {
            const on = s.value === sort;
            return (
              <Pressable key={s.value} onPress={() => setSort(s.value)} style={[styles.sortChip, on && styles.sortChipOn]}>
                <Text style={[styles.sortText, on && styles.sortTextOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.toolbarActions}>
          <View style={styles.viewToggle}>
            <Pressable
              onPress={() => setView('table')}
              accessibilityRole="button"
              accessibilityLabel="Table view"
              style={[styles.viewBtn, view === 'table' && styles.viewBtnOn]}>
              <Ionicons name="grid-outline" size={15} color={view === 'table' ? '#FFFFFF' : palette.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setView('cards')}
              accessibilityRole="button"
              accessibilityLabel="Card view"
              style={[styles.viewBtn, view === 'cards' && styles.viewBtnOn]}>
              <Ionicons name="albums-outline" size={15} color={view === 'cards' ? '#FFFFFF' : palette.textSecondary} />
            </Pressable>
          </View>
          <Pressable onPress={exportList} accessibilityRole="button" style={styles.exportBtn}>
            <Text style={styles.exportText}>Export</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} title={title} />
            </View>
          </GestureDetector>

          {view === 'cards' ? (
            <FlatList
              ref={listRef}
              data={sorted}
              keyExtractor={(a) => a.id}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                onScrollTop(e);
                dismiss.onScroll(e);
              }}
              scrollEventThrottle={16}
              ListHeaderComponent={toolbar}
              renderItem={({ item }) => <ArticleCard article={item} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={styles.empty}>No articles.</Text>}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.tableBody}
              showsVerticalScrollIndicator={false}
              onScroll={dismiss.onScroll}
              scrollEventThrottle={16}>
              {toolbar}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={[styles.tr, styles.thead]}>
                    <Text style={[styles.th, styles.cSv]}>Story Value</Text>
                    <Text style={[styles.th, styles.cAve]}>AVE</Text>
                    <Text style={[styles.th, styles.cHl]}>Headline</Text>
                    <Text style={[styles.th, styles.cOut]}>Media Outlet</Text>
                    <Text style={[styles.th, styles.cSent]}>Sentiment</Text>
                    <Text style={[styles.th, styles.cDate]}>Date</Text>
                  </View>
                  {sorted.map((a) => (
                    <Pressable key={a.id} onPress={() => setDetail(a)} style={({ pressed }) => [styles.tr, pressed && styles.trPressed]}>
                      <Text style={[styles.td, styles.cSv, styles.tdStrong]}>{a.storyValue.toFixed(2)}</Text>
                      <Text style={[styles.td, styles.cAve, styles.tdAve]}>{compactAve(a.ave)}</Text>
                      <Text style={[styles.td, styles.cHl]} numberOfLines={2}>{a.title}</Text>
                      <Text style={[styles.td, styles.cOut]} numberOfLines={1}>{a.outlet}</Text>
                      <View style={[styles.cSent, styles.sentCell]}>
                        <View style={[styles.sentDot, { backgroundColor: SENTIMENT_DOT[a.sentiment] }]} />
                        <Text style={styles.sentText}>{a.sentiment}</Text>
                      </View>
                      <Text style={[styles.td, styles.cDate]} numberOfLines={1}>{a.date}</Text>
                    </Pressable>
                  ))}
                  {sorted.length === 0 ? <Text style={styles.empty}>No articles.</Text> : null}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </Animated.View>
        <BackToTop visible={showTop} anchor="safe" onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
      </GestureHandlerRootView>

      {articles.length > 0 && (
        <ArticleDetailModal visible={detail !== null} article={detail ?? articles[0]} onClose={() => setDetail(null)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF8F4' },
  fill: { flex: 1 },
  body: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  tableBody: { paddingBottom: Spacing.six },
  subtitle: { fontSize: 13, color: palette.textSecondary, marginBottom: Spacing.two },
  separator: { height: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, marginBottom: Spacing.three },
  empty: { textAlign: 'center', color: '#8A8580', paddingVertical: Spacing.six },

  // Toolbar
  toolbar: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one, paddingBottom: Spacing.two, gap: Spacing.two },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sortRow: { gap: Spacing.one, paddingRight: Spacing.two },
  sortChip: { paddingHorizontal: Spacing.two + 2, paddingVertical: 5, borderRadius: 999, backgroundColor: palette.pill },
  sortChipOn: { backgroundColor: '#1A1A1A' },
  sortText: { fontSize: 12, fontWeight: '600', color: palette.textSecondary },
  sortTextOn: { color: '#FFFFFF' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginLeft: 'auto' },
  viewToggle: { flexDirection: 'row', borderRadius: 8, backgroundColor: palette.pill, padding: 2, gap: 2 },
  viewBtn: { width: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  viewBtnOn: { backgroundColor: '#1A1A1A' },
  exportBtn: { paddingHorizontal: Spacing.two + 2, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1A1A1A' },
  exportText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Table
  thead: { borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: '#F2F1ED' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, gap: Spacing.two },
  trPressed: { backgroundColor: '#F7F5F0' },
  th: { fontSize: 10, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  td: { fontSize: 12, color: palette.text },
  tdStrong: { fontWeight: '700' },
  tdAve: { fontWeight: '600', color: '#16A34A' },
  cSv: { width: 72 },
  cAve: { width: 72 },
  cHl: { width: 220 },
  cOut: { width: 150 },
  cSent: { width: 92 },
  cDate: { width: 104 },
  sentCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sentDot: { width: 7, height: 7, borderRadius: 3.5 },
  sentText: { fontSize: 12, color: palette.text, textTransform: 'capitalize' },
});
