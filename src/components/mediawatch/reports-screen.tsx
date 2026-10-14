// MediaWatch Reports — a filtered list of saved/generated reports (web parity:
// reports.html). Frequency filter + search; each card shows AVE / Reach / Story
// Value and a "View Report" action. Generation/opening is simulated, matching
// the reference and the app's other export flows.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { PageHeading } from '@/components/page-heading';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { compactCount, formatAve } from '@/data/mediawatch-metrics';
import { mediawatchReports } from '@/data/mediawatch-articles';
import type { ReportFrequency } from '@/data/mediawatch-types';

type FreqFilter = ReportFrequency | 'All';
const FREQS: FreqFilter[] = ['All', 'Weekly', 'Monthly', 'Annually'];

const palette = { background: '#F5F4F0', card: '#FFFFFF', text: '#1A1A1A', textSecondary: '#6B7280', border: '#E4E6EA', pillBg: '#F0EEEA' };

export function ReportsScreen() {
  const { accentColor } = useAuth();
  const [query, setQuery] = useState('');
  const [freq, setFreq] = useState<FreqFilter>('All');
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll } = useScrollToTop();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mediawatchReports.filter(
      (r) => (freq === 'All' || r.frequency === freq) && (q === '' || r.name.toLowerCase().includes(q)),
    );
  }, [query, freq]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <PageHeading title="Reports" description="Scheduled & on-demand" count={mediawatchReports.length} />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={palette.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search reports…"
            placeholderTextColor={palette.textSecondary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={16} color={palette.textSecondary} />
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.freqBadge}>
                  <Ionicons name="document-text-outline" size={14} color="#6B4DE8" />
                  <Text style={styles.freqBadgeText}>{item.frequency}</Text>
                </View>
                <Text style={styles.period}>{item.period}</Text>
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardType}>{item.type}</Text>
              <View style={styles.statRow}>
                <Stat label="AVE" value={formatAve(item.ave)} />
                <Stat label="Reach" value={compactCount(item.reach)} />
                <Stat label="Story Value" value={item.storyValue.toFixed(2)} />
              </View>
              <Pressable
                onPress={() => Alert.alert('View Report', `"${item.name}" would open as a full PDF/web report.`)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.viewBtn, pressed && styles.pressed]}>
                <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                <Text style={styles.viewBtnText}>View Report</Text>
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
          ListEmptyComponent={<Text style={styles.empty}>No reports match your search.</Text>}
        />

        <BackToTop visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} bottomOffset={-16} />
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 14, color: palette.text, padding: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: 999, backgroundColor: palette.pillBg },
  chipText: { fontSize: 13, fontWeight: '600', color: palette.text },
  chipTextOn: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.three },
  card: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freqBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(107,77,232,0.1)', borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  freqBadgeText: { fontSize: 11, fontWeight: '700', color: '#6B4DE8' },
  period: { fontSize: 12, color: palette.textSecondary },
  cardName: { fontSize: 15, fontWeight: '700', lineHeight: 20, color: palette.text },
  cardType: { fontSize: 12, color: palette.textSecondary },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.one },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: palette.text },
  statLabel: { fontSize: 10, color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: palette.text, borderRadius: 10, paddingVertical: Spacing.two + 2, marginTop: Spacing.one },
  viewBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  empty: { textAlign: 'center', color: palette.textSecondary, paddingTop: Spacing.six },
  pressed: { opacity: 0.6 },
});
