// Categories — a first-class screen (reached from the More tab), so the app's
// bottom tab bar stays visible and there's no modal ✕; you leave by tapping a
// tab. Replaces the old BrowseCategoriesModal. Hierarchy: a scannable grid of
// colored category tiles (icon + bucket count) and a search box across the
// whole taxonomy, then a per-category detail that lists its buckets/keywords
// AND can push that category into the Home feed filter ("Show in Home").
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useCategoryFilter } from '@/contexts/category-filter-context';
import { Bucket, Category, CATEGORY_TAXONOMY } from '@/data/taxonomy';

type IoniconName = keyof typeof Ionicons.glyphMap;

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#181D26',
  textSecondary: '#6B7280',
  faint: '#9CA3AF',
  border: '#E4E6EA',
  pillBg: '#F0F0F0',
  excludedBg: '#FBE9E7',
  excludedText: '#B0463C',
};

// One shared icon for every category — the taxonomy carries no per-category
// icon, so differentiation comes from color, not the glyph. A price-tag reads
// as "a group of keyword tags", which is exactly what a category is here.
const CATEGORY_ICON: IoniconName = 'pricetags';

// Tiles still read apart because each gets an accent cycled from this palette
// by its position in the taxonomy (same approach as the Saved folder tiles),
// which needs no per-category data and works for any number of categories.
const TILE_COLORS = ['#2563EB', '#0D9488', '#7C3AED', '#E94F37', '#16A34A', '#D97706'];

function colorFor(name: string) {
  const index = CATEGORY_TAXONOMY.findIndex((c) => c.name === name);
  return TILE_COLORS[(index < 0 ? 0 : index) % TILE_COLORS.length];
}

export default function CategoriesScreen() {
  const router = useRouter();
  const { accentColor } = useAuth();
  const { setSelectedCategory } = useCategoryFilter();
  const [query, setQuery] = useState('');
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const trimmed = query.trim().toLowerCase();

  // Flat list of buckets whose category, bucket name, or any keyword matches
  // the query — the fast way to find a specific term across the whole tree.
  const results = useMemo<{ category: Category; bucket: Bucket }[]>(() => {
    if (!trimmed) return [];
    const rows: { category: Category; bucket: Bucket }[] = [];
    for (const category of CATEGORY_TAXONOMY) {
      for (const bucket of category.buckets) {
        const haystack = [
          category.name,
          bucket.name,
          ...bucket.keywords.main,
          ...(bucket.keywords.additional ?? []),
          ...(bucket.keywords.related ?? []),
          ...(bucket.keywords.excluded ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (haystack.includes(trimmed)) rows.push({ category, bucket });
      }
    }
    return rows;
  }, [trimmed]);

  function showInHome(categoryName: string) {
    setSelectedCategory(categoryName);
    // Reset back to the grid so returning to this tab later lands on the
    // overview, not the detail we're leaving from.
    setOpenCategory(null);
    // navigate() unwinds to the existing Home (index) route and selects its
    // tab, rather than pushing a second copy onto the stack.
    router.navigate('/');
  }

  // ── Category detail ──
  const detailCategory = openCategory
    ? CATEGORY_TAXONOMY.find((c) => c.name === openCategory) ?? null
    : null;

  if (detailCategory) {
    return (
      <CategoryDetail
        category={detailCategory}
        accentColor={accentColor}
        onBack={() => setOpenCategory(null)}
        onShowInHome={() => showInHome(detailCategory.name)}
      />
    );
  }

  // ── Overview (grid + search) ──
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <PageHeading
              title="Categories"
              description="Topics & keyword buckets"
              count={CATEGORY_TAXONOMY.length}
            />
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={palette.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search buckets & keywords"
              placeholderTextColor={palette.faint}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={palette.faint} />
              </Pressable>
            ) : null}
          </View>

          {trimmed ? (
            // Search results
            results.length > 0 ? (
              <View style={styles.resultList}>
                {results.map(({ category, bucket }) => {
                  const color = colorFor(category.name);
                  return (
                    <Pressable
                      key={`${category.name}/${bucket.name}`}
                      onPress={() => {
                        setOpenCategory(category.name);
                        setQuery('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${bucket.name}, in ${category.name}`}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                      <View style={[styles.resultDot, { backgroundColor: color }]} />
                      <View style={styles.resultText}>
                        <Text style={styles.resultBucket} numberOfLines={1}>
                          {bucket.name}
                        </Text>
                        <Text style={styles.resultCategory} numberOfLines={1}>
                          {category.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={palette.faint} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.empty}>No buckets or keywords match “{query.trim()}”.</Text>
            )
          ) : (
            // Category tile grid
            <View style={styles.grid}>
              {CATEGORY_TAXONOMY.map((category) => (
                <CategoryTile
                  key={category.name}
                  category={category}
                  onPress={() => setOpenCategory(category.name)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  const color = colorFor(category.name);
  const count = category.buckets.length;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${count} buckets`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.tileIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={CATEGORY_ICON} size={20} color={color} />
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {category.name}
      </Text>
      <Text style={styles.tileCount}>
        {count} {count === 1 ? 'bucket' : 'buckets'}
      </Text>
    </Pressable>
  );
}

function CategoryDetail({
  category,
  accentColor,
  onBack,
  onShowInHome,
}: {
  category: Category;
  accentColor: string;
  onBack: () => void;
  onShowInHome: () => void;
}) {
  const color = colorFor(category.name);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Pull the header bar down (or tap ✕) to return to the category grid — the
  // same dismiss gesture the brief screen and detail sheets use.
  const dismiss = useDismissGesture(onBack);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onBack}>
                <View style={styles.detailHeaderLeft}>
                  <View style={[styles.detailIcon, { backgroundColor: `${color}1A` }]}>
                    <Ionicons name={CATEGORY_ICON} size={18} color={color} />
                  </View>
                  <Text style={styles.detailTitle} numberOfLines={1}>
                    {category.name}
                  </Text>
                </View>
              </SheetHeader>
            </View>
          </GestureDetector>

          <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
            <Pressable
            onPress={onShowInHome}
            accessibilityRole="button"
            accessibilityLabel={`Show ${category.name} in Home feed`}
            style={({ pressed }) => [styles.showInHome, { backgroundColor: accentColor }, pressed && styles.pressed]}>
            <View style={styles.showInHomeIcon}>
              <Ionicons name="eye" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.showInHomeText}>
              <Text style={styles.showInHomeTitle}>Show in Home feed</Text>
              <Text style={styles.showInHomeSub}>Filter mentions to this category</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>

          <Text style={styles.sectionLabel}>
            {category.buckets.length} {category.buckets.length === 1 ? 'bucket' : 'buckets'}
          </Text>

          {category.buckets.map((bucket) => {
            const isOpen = expanded.has(bucket.name);
            return (
              <View key={bucket.name} style={styles.bucketBlock}>
                <Pressable
                  onPress={() => toggle(bucket.name)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => [styles.bucketRow, pressed && styles.pressed]}>
                  <Text style={styles.bucketText}>{bucket.name}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={palette.textSecondary}
                  />
                </Pressable>
                {isOpen ? (
                  <View style={styles.keywordPanel}>
                    <KeywordGroup label="Main Keywords" words={bucket.keywords.main} />
                    {bucket.keywords.additional ? (
                      <KeywordGroup label="Additional Keywords" words={bucket.keywords.additional} />
                    ) : null}
                    {bucket.keywords.related ? (
                      <KeywordGroup label="Related Keywords" words={bucket.keywords.related} />
                    ) : (
                      <Text style={styles.emptyKeywords}>No related keywords added</Text>
                    )}
                    {bucket.keywords.excluded ? (
                      <KeywordGroup label="Excluded Keywords" words={bucket.keywords.excluded} excluded />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function KeywordGroup({ label, words, excluded }: { label: string; words: string[]; excluded?: boolean }) {
  return (
    <View style={styles.keywordGroup}>
      <Text style={styles.keywordGroupLabel}>{label}</Text>
      <View style={styles.keywordChipRow}>
        {words.map((word) => (
          <View key={word} style={[styles.keywordChip, excluded && styles.keywordChipExcluded]}>
            <Text style={[styles.keywordChipText, excluded && styles.keywordChipTextExcluded]}>{word}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: 2,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two + 2 : Spacing.one,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
    paddingVertical: Spacing.one,
  },

  // Results
  resultList: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resultText: {
    flex: 1,
  },
  resultBucket: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  resultCategory: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 1,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 116,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: Spacing.three,
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  tileCount: {
    fontSize: 12,
    color: palette.textSecondary,
  },

  // Detail
  fill: {
    flex: 1,
  },
  detailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  detailBody: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },

  // Show-in-Home action
  showInHome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.three,
  },
  showInHomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showInHomeText: {
    flex: 1,
  },
  showInHomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  showInHomeSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Buckets
  bucketBlock: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  bucketText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  keywordPanel: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  keywordGroup: {
    gap: 4,
  },
  keywordGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
  },
  keywordChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.pillBg,
  },
  keywordChipExcluded: {
    backgroundColor: palette.excludedBg,
  },
  keywordChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  keywordChipTextExcluded: {
    color: palette.excludedText,
    textDecorationLine: 'line-through',
  },
  emptyKeywords: {
    fontSize: 12,
    fontStyle: 'italic',
    color: palette.textSecondary,
  },

  empty: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
