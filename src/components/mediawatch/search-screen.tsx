// MediaWatch Search — the Search-tab content when activeView is MediaWatch.
// Searches the news-article corpus plus derived publishers & authors; article
// hits render as ArticleCards, publisher/author hits as rows that jump to their
// list pages. SharedView's global search (src/app/search.tsx) is untouched.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { CollapsibleHeader } from '@/components/collapsible-header';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useHideOnScroll } from '@/contexts/tab-bar-visibility-context';
import { buildAuthors, buildPublishers, formatAve } from '@/data/mediawatch-metrics';
import { newsArticles } from '@/data/mediawatch-articles';
import type { EntityStat, NewsArticle } from '@/data/mediawatch-types';

type IoniconName = keyof typeof Ionicons.glyphMap;
type GroupType = 'article' | 'publisher' | 'author';

const palette = { background: '#F5F4F0', card: '#FFFFFF', text: '#1A1A1A', textSecondary: '#8A8580', border: '#E7DDCC', chipBg: '#EDE6D8' };
const TYPE_META: Record<GroupType, { label: string; icon: IoniconName; color: string }> = {
  article: { label: 'Articles', icon: 'newspaper', color: '#2563EB' },
  publisher: { label: 'Publishers', icon: 'business', color: '#0D9488' },
  author: { label: 'Authors', icon: 'person', color: '#7C3AED' },
};
const PREVIEW: Record<GroupType, number> = { article: 3, publisher: 4, author: 4 };
const SUGGESTIONS = ['Sealion 7', 'Seal 5 DM-i', 'Tesla', 'Dealership', 'AVE', 'Battery'];

function matchArticle(a: NewsArticle, q: string): boolean {
  const hay = `${a.title} ${a.outlet} ${a.author} ${a.section} ${a.entities.join(' ')} ${a.keywords.map(([t]) => t).join(' ')}`.toLowerCase();
  return hay.includes(q);
}

export function MediaWatchSearch() {
  const router = useRouter();
  const { accentColor } = useAuth();
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const { hideProgress, onScroll: onHideScroll } = useHideOnScroll();
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<GroupType | 'all'>('all');
  const [headerH, setHeaderH] = useState(140);
  const scrollRef = useRef<ScrollView>(null);

  const publishers = useMemo(() => buildPublishers(newsArticles), []);
  const authors = useMemo(() => buildAuthors(newsArticles), []);

  const q = query.trim().toLowerCase();
  const hasQuery = q.length > 0;

  const articleHits = useMemo(() => (hasQuery ? newsArticles.filter((a) => matchArticle(a, q)) : []), [q, hasQuery]);
  const publisherHits = useMemo(() => (hasQuery ? publishers.filter((p) => p.name.toLowerCase().includes(q)) : []), [q, hasQuery, publishers]);
  const authorHits = useMemo(() => (hasQuery ? authors.filter((a) => a.name.toLowerCase().includes(q)) : []), [q, hasQuery, authors]);

  const groups = useMemo(() => {
    const g: { type: GroupType; count: number }[] = [];
    if (articleHits.length) g.push({ type: 'article', count: articleHits.length });
    if (publisherHits.length) g.push({ type: 'publisher', count: publisherHits.length });
    if (authorHits.length) g.push({ type: 'author', count: authorHits.length });
    return g;
  }, [articleHits, publisherHits, authorHits]);

  const total = articleHits.length + publisherHits.length + authorHits.length;

  function EntityRow({ entity, type }: { entity: EntityStat; type: GroupType }) {
    const meta = TYPE_META[type];
    return (
      <Pressable
        onPress={() => router.push(type === 'publisher' ? ('/mw-publishers' as never) : ('/mw-authors' as never))}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={[styles.rowIcon, { backgroundColor: `${meta.color}1A` }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {entity.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {entity.count} {entity.count === 1 ? 'article' : 'articles'} · {formatAve(entity.totalAve)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
      </Pressable>
    );
  }

  function renderGroupItems(type: GroupType, limit?: number) {
    if (type === 'article') {
      const items = limit ? articleHits.slice(0, limit) : articleHits;
      return (
        <View style={styles.postList}>
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </View>
      );
    }
    const list = type === 'publisher' ? publisherHits : authorHits;
    const items = limit ? list.slice(0, limit) : list;
    return (
      <View style={styles.rowList}>
        {items.map((e) => (
          <EntityRow key={e.name} entity={e} type={type} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <CollapsibleHeader progress={hideProgress} onHeightChange={setHeaderH}>
          <View style={styles.header}>
            <PageHeading title="Search" description="Articles, publishers & authors" />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={palette.textSecondary} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setActiveType('all');
              }}
              placeholder="Headlines, outlets, authors, topics…"
              placeholderTextColor={palette.textSecondary}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={palette.textSecondary} />
              </Pressable>
            )}
          </View>
          {hasQuery && total > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <TypeChip label="All" count={total} active={activeType === 'all'} onPress={() => setActiveType('all')} />
              {groups.map((g) => (
                <TypeChip key={g.type} label={TYPE_META[g.type].label} count={g.count} active={activeType === g.type} onPress={() => setActiveType(g.type)} />
              ))}
            </ScrollView>
          )}
        </CollapsibleHeader>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: headerH + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            onHideScroll(e);
            onScrollTop(e);
          }}
          scrollEventThrottle={16}>
          {!hasQuery ? (
            <View style={styles.initial}>
              <Text style={styles.initialLabel}>Try searching</Text>
              <View style={styles.suggestWrap}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => setQuery(s)} accessibilityRole="button" style={({ pressed }) => [styles.suggestChip, pressed && styles.pressed]}>
                    <Ionicons name="sparkles-outline" size={13} color={palette.textSecondary} />
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.initialHint}>Search across news articles, publishers, and authors in MediaWatch.</Text>
            </View>
          ) : total === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search" size={30} color={palette.textSecondary} />
              <Text style={styles.emptyText}>No results for “{query.trim()}”.</Text>
              <Text style={styles.emptyHint}>Try a shorter or different keyword.</Text>
            </View>
          ) : activeType === 'all' ? (
            groups.map((g) => {
              const meta = TYPE_META[g.type];
              const limit = PREVIEW[g.type];
              return (
                <View key={g.type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                    <Text style={styles.sectionTitle}>{meta.label}</Text>
                    <View style={[styles.sectionCount, { backgroundColor: `${meta.color}1A` }]}>
                      <Text style={[styles.sectionCountText, { color: meta.color }]}>{g.count}</Text>
                    </View>
                    <View style={styles.spacer} />
                    {g.count > limit && (
                      <Pressable onPress={() => setActiveType(g.type)} hitSlop={6} accessibilityRole="button">
                        <Text style={[styles.seeAll, { color: accentColor }]}>See all →</Text>
                      </Pressable>
                    )}
                  </View>
                  {renderGroupItems(g.type, limit)}
                </View>
              );
            })
          ) : (
            renderGroupItems(activeType)
          )}
        </ScrollView>

        <BackToTop visible={showTop} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
      </SafeAreaView>
    </View>
  );
}

function TypeChip({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginHorizontal: Spacing.four, marginBottom: Spacing.two, paddingHorizontal: Spacing.three, height: 44, borderRadius: Spacing.three, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  input: { flex: 1, fontSize: 15, color: palette.text },
  chipRow: { gap: Spacing.one + 2, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: Spacing.two + 2, paddingRight: 6, paddingVertical: 5, borderRadius: 999, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { fontSize: 13, fontWeight: '600', color: palette.text },
  chipTextActive: { color: '#FFFFFF' },
  chipCount: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: palette.chipBg, alignItems: 'center' },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  chipCountText: { fontSize: 11, fontWeight: '700', color: palette.textSecondary },
  chipCountTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: Spacing.four, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: palette.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionCount: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, alignItems: 'center' },
  sectionCountText: { fontSize: 11, fontWeight: '700' },
  spacer: { flex: 1 },
  seeAll: { fontSize: 12, fontWeight: '700' },
  postList: { gap: Spacing.four },
  rowList: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: palette.text },
  rowSub: { fontSize: 12, color: palette.textSecondary },
  pressed: { opacity: 0.6 },
  emptyWrap: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.six },
  emptyText: { fontSize: 15, fontWeight: '600', color: palette.text },
  emptyHint: { fontSize: 13, color: palette.textSecondary },
  initial: { gap: Spacing.three, paddingTop: Spacing.two },
  initialLabel: { fontSize: 12, fontWeight: '700', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  suggestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  suggestChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 3, borderRadius: 999, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  suggestText: { fontSize: 13, fontWeight: '600', color: palette.text },
  initialHint: { fontSize: 13, lineHeight: 19, color: palette.textSecondary, marginTop: Spacing.two },
});
