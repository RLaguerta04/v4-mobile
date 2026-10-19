// Compare Categories/Buckets — the mobile port of the web's Compare Topics
// modal + compare view (openCompareModal / #db-compare-explore). Two steps:
// pick 2–4 categories, then see them compared side-by-side — Share of Voice,
// per-category summary cards, and a tonality split per category.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareBar } from '@/components/dashboard/bars';
import { DbCard, Legend } from '@/components/dashboard/chart-card';
import { SENTIMENT_COLOR } from '@/components/dashboard/palette';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  buildCategoryComparison,
  COMPARE_CATEGORIES,
} from '@/data/article-dashboard-metrics';
import { compactAve } from '@/data/mediawatch-metrics';
import { newsArticles } from '@/data/mediawatch-articles';

export function CompareSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accentColor = useAccentColor();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[] | null>(null);

  const comparison = useMemo(
    () => (confirmed ? buildCategoryComparison(newsArticles, confirmed) : []),
    [confirmed],
  );

  function toggle(cat: string) {
    setSelected((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : prev.length < 4 ? [...prev, cat] : prev));
  }
  function reset() {
    setSelected([]);
    setConfirmed(null);
  }
  function handleClose() {
    reset();
    onClose();
  }

  const sovSegments = comparison.map((c) => ({ label: c.category, value: c.articles, color: c.color }));

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {confirmed ? 'Compare Topics' : 'Compare Categories'}
          </Text>
          <View style={styles.headerActions}>
            {confirmed ? (
              <Pressable onPress={() => setConfirmed(null)} accessibilityRole="button" hitSlop={8} style={styles.headerBtn}>
                <Ionicons name="chevron-back" size={22} color={theme.text} />
              </Pressable>
            ) : null}
            <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {!confirmed ? (
          <>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>Select 2–4 categories to compare their coverage.</Text>
              {COMPARE_CATEGORIES.map((cat) => {
                const on = selected.includes(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => toggle(cat)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}>
                    <View style={[styles.checkbox, on && { backgroundColor: accentColor, borderColor: accentColor }]}>
                      {on ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={styles.pickLabel}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
              <Pressable onPress={reset} style={styles.resetBtn}>
                <Text style={styles.resetText}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => selected.length >= 2 && setConfirmed(selected)}
                disabled={selected.length < 2}
                style={[styles.compareBtn, { backgroundColor: accentColor }, selected.length < 2 && styles.compareBtnDisabled]}>
                <Text style={styles.compareText}>Compare {selected.length >= 2 ? `(${selected.length})` : ''}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <DbCard title="Share of Voice">
              <ShareBar segments={sovSegments} />
              <Legend items={sovSegments.map((s) => ({ label: s.label, color: s.color, note: `${s.value}` }))} />
            </DbCard>

            {comparison.map((c) => {
              const tot = c.sentiment.positive + c.sentiment.neutral + c.sentiment.negative || 1;
              return (
                <DbCard key={c.category} title={c.category}>
                  <View style={styles.statRow}>
                    <Stat label="Articles" value={String(c.articles)} />
                    <Stat label="Total AVE" value={compactAve(c.ave)} />
                    <Stat label="Avg SV" value={c.avgSV.toFixed(2)} />
                  </View>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    Top publisher: <Text style={styles.metaStrong}>{c.topPublisher ?? '—'}</Text>
                  </Text>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    Top entity: <Text style={styles.metaStrong}>{c.topEntity ?? '—'}</Text>
                  </Text>
                  <View style={styles.sentBar}>
                    {(['positive', 'neutral', 'negative'] as const).map((s) =>
                      c.sentiment[s] > 0 ? (
                        <View key={s} style={{ flexGrow: c.sentiment[s], flexBasis: 0, height: 8, backgroundColor: SENTIMENT_COLOR[s] }} />
                      ) : null,
                    )}
                  </View>
                  <Text style={styles.sentCaption}>
                    {Math.round((c.sentiment.positive / tot) * 100)}% positive · {Math.round((c.sentiment.negative / tot) * 100)}% negative
                  </Text>
                </DbCard>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: t.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hint: { fontSize: 13, color: t.textSecondary },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  pressed: { opacity: 0.6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: t.borderCool,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickLabel: { fontSize: 15, fontWeight: '600', color: t.text },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: t.borderCool,
  },
  resetBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 999, backgroundColor: t.topicBg },
  resetText: { fontSize: 15, fontWeight: '700', color: t.text },
  compareBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, borderRadius: 999 },
  compareBtnDisabled: { opacity: 0.4 },
  compareText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  statRow: { flexDirection: 'row', gap: Spacing.four },
  stat: { gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: t.text },
  statLabel: { fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaLine: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
  metaStrong: { fontWeight: '700', color: t.text },
  sentBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.two, gap: 1 },
  sentCaption: { fontSize: 11, color: t.textSecondary, marginTop: 4 },
});
