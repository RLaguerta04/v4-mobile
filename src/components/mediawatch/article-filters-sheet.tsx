// MediaWatch article filters — the article analogue of MentionsFiltersSheet.
// Kept separate (not a retrofit of the social sheet) so SharedView's filters
// stay untouched and the two workspaces remain independent. Same visual
// language, driven by ArticleFilters (sort / media channel / sentiment / story
// value / categories & buckets / date range / country).
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { CATEGORY_TAXONOMY } from '@/data/taxonomy';
import type { Sentiment } from '@/data/types';
import { ArticleFilters, ArticleSort, CHANNEL_TYPES, defaultArticleFilters } from '@/data/mediawatch-metrics';
import type { MediaChannel } from '@/data/mediawatch-types';

const palette = {
  sheetBg: '#FFFFFF',
  pillBg: '#F0F0F0',
  pillText: '#1A1A1A',
  pillSelectedText: '#FFFFFF',
  sectionLabel: '#6B7280',
  border: '#E4E6EA',
};

const SORTS: { value: ArticleSort; label: string }[] = [
  { value: 'newest', label: 'Newest Articles' },
  { value: 'oldest', label: 'Oldest Articles' },
  { value: 'value-high', label: 'Highest Value' },
  { value: 'value-low', label: 'Lowest Value' },
];

const CHANNELS: (MediaChannel | 'All')[] = ['All', 'Online', 'TV', 'Print', 'Radio'];
const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative'];
const SV_TIERS: { label: string; min: number; max: number }[] = [
  { label: 'All', min: 0, max: 10 },
  { label: 'High (7–10)', min: 7, max: 10 },
  { label: 'Mid (4–7)', min: 4, max: 7 },
  { label: 'Low (0–4)', min: 0, max: 4 },
];
const QUICK_RANGES: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
];

function channelOf(set: Set<string>): MediaChannel | 'All' {
  if (set.size === 0) return 'All';
  for (const ch of ['Online', 'TV', 'Radio', 'Print'] as MediaChannel[]) {
    const types = CHANNEL_TYPES[ch];
    if (types.length === set.size && types.every((t) => set.has(t))) return ch;
  }
  return 'All';
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { accentColor } = useAuth();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active && { backgroundColor: accentColor }]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function ArticleFiltersSheet({
  visible,
  initialFilters,
  onApply,
  onClose,
}: {
  visible: boolean;
  initialFilters: ArticleFilters;
  onApply: (filters: ArticleFilters) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { accentColor } = useAuth();
  const [pending, setPending] = useState<ArticleFilters>(initialFilters);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPending(initialFilters);
      setExpandedCategory(null);
    }
  }, [visible, initialFilters]);

  const activeChannel = channelOf(pending.mediaTypes);

  function selectChannel(ch: MediaChannel | 'All') {
    setPending((p) => ({
      ...p,
      mediaTypes: ch === 'All' ? new Set() : new Set(CHANNEL_TYPES[ch]),
    }));
  }

  function toggleSentiment(s: Sentiment) {
    setPending((p) => {
      const next = new Set(p.sentiments);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return { ...p, sentiments: next };
    });
  }

  function toggleTopic(topic: string) {
    setPending((p) => ({
      ...p,
      topics: p.topics.has(topic) ? new Set<string>() : new Set([topic]),
    }));
  }

  function applyQuickRange(days: number) {
    const end = startOfDay(new Date());
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - days);
    setPending((p) => ({ ...p, dateRange: { start, end } }));
  }

  function handleReset() {
    setPending(defaultArticleFilters(pending.category));
    setExpandedCategory(null);
  }

  const svActive = (tier: { min: number; max: number }) =>
    pending.storyValueRange.min === tier.min && pending.storyValueRange.max === tier.max;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.sheet,
          { paddingTop: Math.max(insets.top, Spacing.three), paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" style={styles.closeButton}>
            <Ionicons name="close" size={18} color={palette.pillText} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <SectionLabel>Sort by</SectionLabel>
          <View style={styles.pillRow}>
            {SORTS.map((s) => (
              <Pill key={s.value} label={s.label} active={pending.sort === s.value} onPress={() => setPending((p) => ({ ...p, sort: s.value }))} />
            ))}
          </View>

          <SectionLabel>Media</SectionLabel>
          <View style={styles.pillRow}>
            {CHANNELS.map((ch) => (
              <Pill key={ch} label={ch} active={activeChannel === ch} onPress={() => selectChannel(ch)} />
            ))}
          </View>

          <SectionLabel>Sentiment</SectionLabel>
          <View style={styles.pillRow}>
            <Pill label="All" active={pending.sentiments.size === 0} onPress={() => setPending((p) => ({ ...p, sentiments: new Set() }))} />
            {SENTIMENTS.map((s) => (
              <Pill key={s} label={s[0].toUpperCase() + s.slice(1)} active={pending.sentiments.has(s)} onPress={() => toggleSentiment(s)} />
            ))}
          </View>

          <SectionLabel>Story Value</SectionLabel>
          <View style={styles.pillRow}>
            {SV_TIERS.map((t) => (
              <Pill key={t.label} label={t.label} active={svActive(t)} onPress={() => setPending((p) => ({ ...p, storyValueRange: { min: t.min, max: t.max } }))} />
            ))}
          </View>

          <SectionLabel>Categories & Buckets</SectionLabel>
          <View style={styles.treeList}>
            {CATEGORY_TAXONOMY.map(({ name: category, buckets }) => {
              const expanded = expandedCategory === category;
              const selected = buckets.map((b) => b.name).filter((t) => pending.topics.has(t));
              return (
                <View key={category} style={styles.treeCategoryDivider}>
                  <Pressable
                    onPress={() => setExpandedCategory((c) => (c === category ? null : category))}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={styles.treeCategoryRow}>
                    <View style={styles.treeCategoryLabelColumn}>
                      <Text style={[styles.treeCategoryText, selected.length > 0 && { color: accentColor }]}>{category}</Text>
                      {selected.length > 0 && (
                        <Text style={styles.treeCategorySubtitle} numberOfLines={1}>
                          {selected.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.sectionLabel} />
                  </Pressable>
                  {expanded && (
                    <View style={styles.treeBucketList}>
                      {buckets.map((bucket) => {
                        const active = pending.topics.has(bucket.name);
                        return (
                          <Pressable
                            key={bucket.name}
                            onPress={() => toggleTopic(bucket.name)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            style={styles.treeBucketRow}>
                            <Text style={[styles.treeBucketText, active && { color: accentColor, fontWeight: '700' }]}>{bucket.name}</Text>
                            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? accentColor : palette.sectionLabel} />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <SectionLabel>Date Range</SectionLabel>
          <View style={styles.pillRow}>
            {QUICK_RANGES.map((r) => (
              <Pill key={r.label} label={r.label} active={false} onPress={() => applyQuickRange(r.days)} />
            ))}
            <Pill label="Clear" active={!pending.dateRange.start} onPress={() => setPending((p) => ({ ...p, dateRange: { start: null, end: null } }))} />
          </View>

          <SectionLabel>Country</SectionLabel>
          <View style={styles.pillRow}>
            <Pill label="Philippines" active onPress={() => {}} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
          <Pressable style={[styles.applyButton, { backgroundColor: accentColor }]} onPress={() => onApply(pending)}>
            <Text style={styles.applyButtonText}>Apply filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.sheetBg,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.three },
  title: { fontSize: 24, fontWeight: '700', color: palette.pillText },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.pillBg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { gap: Spacing.one, paddingBottom: Spacing.three },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: palette.sectionLabel, marginTop: Spacing.three, marginBottom: Spacing.one },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: palette.pillBg },
  pillText: { fontSize: 14, fontWeight: '600', color: palette.pillText },
  pillTextActive: { color: palette.pillSelectedText },
  treeList: { borderTopWidth: 1, borderTopColor: palette.border },
  treeCategoryDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  treeCategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.three },
  treeCategoryLabelColumn: { flex: 1, gap: 2 },
  treeCategoryText: { fontSize: 14, fontWeight: '700', color: palette.pillText },
  treeCategorySubtitle: { fontSize: 13, color: palette.sectionLabel },
  treeBucketList: { paddingBottom: Spacing.two },
  treeBucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  treeBucketText: { fontSize: 14, color: palette.pillText },
  footer: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: palette.border },
  resetButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 999, backgroundColor: palette.pillBg },
  resetButtonText: { fontSize: 15, fontWeight: '700', color: palette.pillText },
  applyButton: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 999 },
  applyButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
