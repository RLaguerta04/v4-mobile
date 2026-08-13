import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { CATEGORY_TAXONOMY } from '@/data/taxonomy';

const palette = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  pillBg: '#F0F0F0',
  excludedBg: '#FBE9E7',
  excludedText: '#B0463C',
};

// Read-only reference browse of the full BYD taxonomy — reached from the
// bottom tab bar's More sheet. Unlike the Filters sheet's Category & Bucket
// tree, nothing here is selectable; it's purely for looking up what buckets
// and keywords exist under each category.
export function BrowseCategoriesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  function toggleCategory(name: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleBucket(name: string) {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Categories</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}>
              <Ionicons name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {CATEGORY_TAXONOMY.map((category) => {
              const categoryExpanded = expandedCategories.has(category.name);
              return (
                <View key={category.name} style={styles.categoryBlock}>
                  <Pressable
                    onPress={() => toggleCategory(category.name)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: categoryExpanded }}
                    style={styles.categoryRow}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                    <Ionicons
                      name={categoryExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={palette.textSecondary}
                    />
                  </Pressable>

                  {categoryExpanded &&
                    category.buckets.map((bucket) => {
                      const bucketExpanded = expandedBuckets.has(bucket.name);
                      return (
                        <View key={bucket.name} style={styles.bucketBlock}>
                          <Pressable
                            onPress={() => toggleBucket(bucket.name)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: bucketExpanded }}
                            style={styles.bucketRow}>
                            <Text style={styles.bucketText}>{bucket.name}</Text>
                            <Ionicons
                              name={bucketExpanded ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={palette.textSecondary}
                            />
                          </Pressable>
                          {bucketExpanded && (
                            <View style={styles.keywordPanel}>
                              <KeywordGroup label="Main Keywords" words={bucket.keywords.main} />
                              {bucket.keywords.additional && (
                                <KeywordGroup label="Additional Keywords" words={bucket.keywords.additional} />
                              )}
                              {bucket.keywords.related ? (
                                <KeywordGroup label="Related Keywords" words={bucket.keywords.related} />
                              ) : (
                                <Text style={styles.emptyText}>No related keywords added</Text>
                              )}
                              {bucket.keywords.excluded && (
                                <KeywordGroup label="Excluded Keywords" words={bucket.keywords.excluded} excluded />
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
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
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  categoryBlock: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  bucketBlock: {
    paddingLeft: Spacing.three,
    paddingBottom: Spacing.two,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  bucketText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  keywordPanel: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
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
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: palette.textSecondary,
  },
});
