// Compare Topics (spec §11) — a mobile adaptation of the web's Compare flow.
// A picker modal selects ≥2 taxonomy categories ("topics"); the compare view
// then shows, grouped by chart so topics sit side-by-side for comparison:
// an overview table + per-topic Platform Exposure, Tonality, Frequency,
// Top Influencers and Entities, each computed from that topic's mentions.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HBarItem, HBarList, ShareBar } from '@/components/dashboard/bars';
import { ChartArea, DbCard, Legend } from '@/components/dashboard/chart-card';
import { Donut, Histogram } from '@/components/dashboard/charts';
import {
  chartTokens,
  PLATFORM_CHART_COLOR,
  SENTIMENT_COLOR,
} from '@/components/dashboard/palette';
import { EntitiesTreemap } from '@/components/dashboard/treemap';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import {
  buildEntitiesMap,
  buildExposure,
  buildFrequency,
  buildTonalityDonut,
} from '@/data/dashboard-metrics';
import { socialMentions } from '@/data/sample-data';
import { bucketsForCategory, CATEGORY_TAXONOMY } from '@/data/taxonomy';
import { SocialMention, SocialPlatform } from '@/data/types';
import { Spacing } from '@/constants/theme';

const CMP_COLORS = ['#7c3aed', '#ea580c', '#2563eb', '#16a34a'];
const MAX_TOPICS = 4;

function mentionsForCategory(name: string): SocialMention[] {
  const buckets = new Set(bucketsForCategory(name));
  return socialMentions.filter((m) => m.entities.some((e) => buckets.has(e)));
}

function topInfluencerItems(ms: SocialMention[]): HBarItem[] {
  const g = new Map<string, { count: number; platform: SocialPlatform }>();
  ms.forEach((m) => {
    const e = g.get(m.handle);
    if (e) e.count += 1;
    else g.set(m.handle, { count: 1, platform: m.platform });
  });
  return [...g.entries()]
    .map(([handle, v]) => ({ label: handle, value: v.count, color: PLATFORM_CHART_COLOR[v.platform] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function topOf<T>(items: T[], key: (t: T) => string): { label: string; count: number } {
  const counts = new Map<string, number>();
  items.forEach((it) => {
    const k = key(it);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? { label: best[0], count: best[1] } : { label: '—', count: 0 };
}

// ── Topic picker ──
export function CompareTopicsModal({
  visible,
  onClose,
  onCompare,
}: {
  visible: boolean;
  onClose: () => void;
  onCompare: (cats: string[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(name: string) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, name];
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Compare Topics</Text>
          <Text style={styles.pickerSub}>Pick 2–{MAX_TOPICS} categories to compare side by side.</Text>
          <FlatList
            data={CATEGORY_TAXONOMY}
            keyExtractor={(c) => c.name}
            style={styles.pickerList}
            renderItem={({ item }) => {
              const on = selected.includes(item.name);
              const idx = selected.indexOf(item.name);
              return (
                <Pressable
                  onPress={() => toggle(item.name)}
                  style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                  <View
                    style={[
                      styles.checkbox,
                      on && { backgroundColor: CMP_COLORS[idx % 4], borderColor: CMP_COLORS[idx % 4] },
                    ]}>
                    {on ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={styles.pickerRowText}>{item.name}</Text>
                  <Text style={styles.pickerRowCount}>{mentionsForCategory(item.name).length}</Text>
                </Pressable>
              );
            }}
          />
          <View style={styles.pickerActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={selected.length < 2}
              onPress={() => onCompare(selected)}
              style={({ pressed }) => [
                styles.compareBtn,
                selected.length < 2 && styles.compareBtnDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.compareText}>Compare ({selected.length})</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Compare view ──
export function CompareView({ cats, onClose }: { cats: string[]; onClose: () => void }) {
  const topics = useMemo(
    () =>
      cats.slice(0, MAX_TOPICS).map((name, i) => {
        const ms = mentionsForCategory(name);
        return { name, color: CMP_COLORS[i % 4], ms };
      }),
    [cats],
  );
  const dismiss = useDismissGesture(onClose);

  return (
    <Modal visible={cats.length > 0} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} breadcrumb={{ current: 'Compare Topics' }} />
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={dismiss.onScroll}
            scrollEventThrottle={16}>
          {/* chips */}
          <View style={styles.chipRow}>
            {topics.map((t) => (
              <View key={t.name} style={[styles.chip, { borderColor: t.color }]}>
                <View style={[styles.chipDot, { backgroundColor: t.color }]} />
                <Text style={styles.chipText}>{t.name}</Text>
              </View>
            ))}
          </View>

          {/* Overview table */}
          <DbCard title="Overview">
            <OverviewTable topics={topics} />
          </DbCard>

          {/* Platform Exposure per topic */}
          <DbCard title="Platform Exposure (Post Count)">
            {topics.map((t) => {
              const exp = buildExposure(t.ms);
              return (
                <View key={t.name} style={styles.topicBlock}>
                  <TopicHeader color={t.color} name={t.name} />
                  {exp.length ? (
                    <>
                      <ShareBar segments={exp.map((e) => ({ label: e.label, value: e.count, color: e.color }))} height={36} />
                      <Legend items={exp.map((e) => ({ label: e.label, color: e.color, note: String(e.count) }))} />
                    </>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
              );
            })}
          </DbCard>

          {/* Tonality per topic */}
          <DbCard title="Tonality Distribution">
            {topics.map((t) => {
              const donut = buildTonalityDonut(t.ms);
              const total = donut.reduce((s, x) => s + x.value, 0);
              return (
                <View key={t.name} style={styles.topicBlock}>
                  <TopicHeader color={t.color} name={t.name} />
                  {total > 0 ? (
                    <View style={styles.center}>
                      <Donut segments={donut} size={140} />
                      <Legend
                        items={donut.map((d) => ({
                          label: d.label,
                          color: d.color,
                          note: `${((d.value / total) * 100).toFixed(0)}%`,
                        }))}
                      />
                    </View>
                  ) : (
                    <Text style={styles.noData}>No data</Text>
                  )}
                </View>
              );
            })}
          </DbCard>

          {/* Frequency per topic */}
          <DbCard title="Frequency Distribution">
            {topics.map((t) => (
              <View key={t.name} style={styles.topicBlock}>
                <TopicHeader color={t.color} name={t.name} />
                <ChartArea height={180}>
                  {(w) => <Histogram bars={buildFrequency(t.ms)} width={w} height={180} xLabel="Story Value" />}
                </ChartArea>
              </View>
            ))}
          </DbCard>

          {/* Top Influencers per topic */}
          <DbCard title="Top Influencers">
            {topics.map((t) => (
              <View key={t.name} style={styles.topicBlock}>
                <TopicHeader color={t.color} name={t.name} />
                <HBarList items={topInfluencerItems(t.ms)} valueFormatter={(v) => `${v}`} emptyText="No data" />
              </View>
            ))}
          </DbCard>

          {/* Entities per topic */}
          <DbCard title="Entities Map">
            {topics.map((t) => {
              const tiles = buildEntitiesMap(t.ms);
              return (
                <View key={t.name} style={styles.topicBlock}>
                  <TopicHeader color={t.color} name={t.name} />
                  {tiles.length ? <EntitiesTreemap tiles={tiles} height={160} /> : <Text style={styles.noData}>No data</Text>}
                </View>
              );
            })}
          </DbCard>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function TopicHeader({ color, name }: { color: string; name: string }) {
  return (
    <View style={styles.topicHeader}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={styles.topicName}>{name}</Text>
    </View>
  );
}

function OverviewTable({ topics }: { topics: { name: string; color: string; ms: SocialMention[] }[] }) {
  const rows = [
    { label: 'Total Results', val: (ms: SocialMention[]) => String(ms.length) },
    { label: 'Top Influencer', val: (ms: SocialMention[]) => topOf(ms, (m) => m.handle).label },
    { label: 'Top Entity', val: (ms: SocialMention[]) => topOf(ms.flatMap((m) => m.entities.map((e) => ({ e }))), (x) => x.e).label },
    {
      label: 'Positive',
      val: (ms: SocialMention[]) =>
        ms.length ? `${Math.round((ms.filter((m) => m.sentiment === 'positive').length / ms.length) * 100)}%` : '—',
    },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[styles.tableRow, styles.tableHead]}>
          <Text style={[styles.tableCell, styles.tableMetric, styles.tableHeadText]}>Metric</Text>
          {topics.map((t) => (
            <Text key={t.name} style={[styles.tableCell, styles.tableHeadText, { color: t.color }]} numberOfLines={1}>
              {t.name}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.label} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableMetric]}>{r.label}</Text>
            {topics.map((t) => (
              <Text key={t.name} style={styles.tableCell} numberOfLines={1}>
                {r.val(t.ms)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // picker
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,26,26,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    maxHeight: '80%',
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: chartTokens.border,
    marginBottom: Spacing.two,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: chartTokens.text,
  },
  pickerSub: {
    fontSize: 13,
    color: chartTokens.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.two,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: chartTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: chartTokens.text,
  },
  pickerRowCount: {
    fontSize: 13,
    color: chartTokens.textSecondary,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: chartTokens.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: chartTokens.text,
  },
  compareBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  compareBtnDisabled: {
    opacity: 0.4,
  },
  compareText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // view
  screen: {
    flex: 1,
    backgroundColor: '#F5F4F0',
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: chartTokens.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crumb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  crumbOverview: {
    fontSize: 13,
    color: chartTokens.textSecondary,
  },
  crumbSep: {
    fontSize: 13,
    color: chartTokens.axisText,
  },
  crumbCurrent: {
    fontSize: 15,
    fontWeight: '700',
    color: chartTokens.text,
  },
  body: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: chartTokens.text,
  },
  topicBlock: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: chartTokens.gridline,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  topicName: {
    fontSize: 13,
    fontWeight: '700',
    color: chartTokens.text,
  },
  center: {
    alignItems: 'center',
  },
  noData: {
    fontSize: 12,
    color: chartTokens.axisText,
    fontStyle: 'italic',
    paddingVertical: Spacing.two,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHead: {
    borderBottomWidth: 1,
    borderBottomColor: chartTokens.border,
    marginBottom: 4,
    paddingBottom: 4,
  },
  tableCell: {
    width: 120,
    fontSize: 12,
    color: chartTokens.text,
    paddingVertical: 4,
    paddingRight: Spacing.two,
  },
  tableMetric: {
    width: 110,
    fontWeight: '600',
    color: chartTokens.textSecondary,
  },
  tableHeadText: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
