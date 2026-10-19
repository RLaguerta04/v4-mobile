// MediaWatch Reports — a filtered list of saved/generated reports (web parity:
// reports.html). Frequency filter + search; each card is tap-to-open and shows
// Story Value / AVE / Reach. Opening is simulated, matching the reference and
// the app's other export flows.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useArticleWorkspace } from '@/data/article-workspace';
import { compactCount, formatAve } from '@/data/mediawatch-metrics';
import type { ReportFrequency } from '@/data/mediawatch-types';

type FreqFilter = ReportFrequency | 'All';
const FREQS: FreqFilter[] = ['All', 'Weekly', 'Monthly', 'Annually'];

type IoniconName = keyof typeof Ionicons.glyphMap;

// Per-frequency pill colour (scheme-aware so the hue stays legible on dark).
// The pill design is shared; only the hue changes by frequency.
const FREQ_META: Record<ReportFrequency, { light: string; dark: string }> = {
  Weekly: { light: '#6B4DE8', dark: '#A78BFA' }, // lilac
  Monthly: { light: '#2563EB', dark: '#60A5FA' }, // blue
  Annually: { light: '#0D9488', dark: '#2DD4BF' }, // teal
};

export function ReportsScreen() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const accentColor = useAccentColor();
  const ws = useArticleWorkspace();
  const [query, setQuery] = useState('');
  const [freq, setFreq] = useState<FreqFilter>('All');
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll } = useScrollToTop();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ws.reports.filter(
      (r) => (freq === 'All' || r.frequency === freq) && (q === '' || r.name.toLowerCase().includes(q)),
    );
  }, [ws.reports, query, freq]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <PageHeading title="Reports" description="Scheduled & on-demand" count={ws.reports.length} />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search reports…"
            placeholderTextColor={theme.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={styles.chipRow}>
          {FREQS.map((f) => {
            const on = f === freq;
            return (
              <Pressable
                key={f}
                onPress={() => setFreq(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && { backgroundColor: accentColor }]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const fm = FREQ_META[item.frequency as ReportFrequency];
            const freqColor = isDark ? fm.dark : fm.light;
            return (
              <Pressable
                onPress={() => Alert.alert('View Report', `"${item.name}" would open as a full PDF/web report.`)}
                accessibilityRole="button"
                accessibilityLabel={`Open report: ${item.name}`}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadLeft}>
                    <View style={[styles.freqBadge, { backgroundColor: `${freqColor}22` }]}>
                      <Ionicons name="time-outline" size={13} color={freqColor} />
                      <Text style={[styles.freqBadgeText, { color: freqColor }]}>{item.frequency}</Text>
                    </View>
                    <Text style={styles.period} numberOfLines={1}>
                      {item.period}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </View>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.statRow}>
                  <Stat icon="star-outline" label="Story Value" value={item.storyValue.toFixed(2)} />
                  <Stat icon="cash-outline" label="AVE" value={formatAve(item.ave)} />
                  <Stat icon="eye-outline" label="Reach" value={compactCount(item.reach)} />
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={<Text style={styles.empty}>No reports match your search.</Text>}
        />

        <BackToTop visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} bottomOffset={-16} />
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, label, value }: { icon: IoniconName; label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Ionicons name={icon} size={12} color={theme.textSecondary} />
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 14, color: t.text, padding: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: t.topicBg },
  chipText: { fontSize: 13, fontWeight: '600', color: t.text },
  chipTextOn: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  // Whole card is tap-to-open; the type colour shows via the icon + tag.
  card: { backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorderCool, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexShrink: 1 },
  // Frequency pill — shape/tint treatment only; the hue (bg + icon + text) is
  // set per-frequency inline (see FREQ_META).
  freqBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  freqBadgeText: { fontSize: 11, fontWeight: '700' },
  period: { fontSize: 12, color: t.textSecondary, flexShrink: 1 },
  cardName: { fontSize: 15, fontWeight: '700', lineHeight: 20, color: t.text },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.one },
  stat: { flex: 1, gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: t.text, flexShrink: 1 },
  statLabel: { fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  empty: { textAlign: 'center', color: t.textSecondary, paddingTop: Spacing.six },
  pressed: { opacity: 0.6 },
});
