// Flex-based bar primitives — crisper text + rounded ends than SVG for these.
// ShareBar = Platform Exposure 100% stacked horizontal bar (spec §3).
// HBarList = the horizontal bar lists used across Explore (Top Influencers,
// Top Entities, per-platform lists) (spec §10).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Theme } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatCompact } from '@/components/dashboard/palette';

export type ShareSegment = { label: string; value: number; color: string };

export function ShareBar({
  segments,
  selectedIndex,
  onSelect,
  height = 48,
}: {
  segments: ShareSegment[];
  selectedIndex?: number | null;
  onSelect?: (i: number) => void;
  height?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const last = segments.length - 1;
  return (
    <View style={[styles.shareRow, { height }]}>
      {segments.map((seg, i) => {
        // Alias out of the style literal below: Reanimated's Babel plugin warns
        // on any `.value` written inside an inline style object (it assumes a
        // shared value), and `seg.value` here is just plain chart data.
        const grow = seg.value;
        const pct = (grow / total) * 100;
        if (pct <= 0) return null;
        const dim = selectedIndex != null && selectedIndex !== i;
        return (
          <Pressable
            key={`${seg.label}-${i}`}
            onPress={onSelect ? () => onSelect(i) : undefined}
            style={[
              styles.shareSeg,
              {
                flexGrow: grow,
                flexBasis: 0,
                backgroundColor: seg.color,
                opacity: dim ? 0.3 : 1,
                borderTopLeftRadius: i === 0 ? 6 : 0,
                borderBottomLeftRadius: i === 0 ? 6 : 0,
                borderTopRightRadius: i === last ? 6 : 0,
                borderBottomRightRadius: i === last ? 6 : 0,
              },
            ]}>
            {pct >= 10 ? (
              <Text style={styles.shareLabel} numberOfLines={1}>
                {seg.label}: {pct.toFixed(pct >= 100 ? 0 : 1)}%
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type HBarItem = { label: string; value: number; color?: string; sub?: string };

export function HBarList({
  items,
  max,
  valueFormatter = (v) => formatCompact(v),
  selectedIndex,
  onSelect,
  barColor = '#2563eb',
  emptyText = 'No Data Found',
}: {
  items: HBarItem[];
  max?: number;
  valueFormatter?: (v: number) => string;
  selectedIndex?: number | null;
  onSelect?: (i: number) => void;
  barColor?: string;
  emptyText?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  const m = max ?? Math.max(1, ...items.map((it) => it.value));
  return (
    <View style={styles.list}>
      {items.map((it, i) => {
        const dim = selectedIndex != null && selectedIndex !== i;
        const w = `${Math.max(2, (it.value / m) * 100)}%` as const;
        const Row = (
          <View style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {it.label}
              {it.sub ? <Text style={styles.rowSub}>  {it.sub}</Text> : null}
            </Text>
            <View style={styles.rowBarWrap}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: w, backgroundColor: it.color ?? barColor, opacity: dim ? 0.4 : 1 },
                  ]}
                />
              </View>
              <Text style={styles.rowValue}>{valueFormatter(it.value)}</Text>
            </View>
          </View>
        );
        return onSelect ? (
          <Pressable key={`${it.label}-${i}`} onPress={() => onSelect(i)} style={({ pressed }) => pressed && styles.pressed}>
            {Row}
          </Pressable>
        ) : (
          <View key={`${it.label}-${i}`}>{Row}</View>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  shareRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 2,
    alignItems: 'stretch',
  },
  shareSeg: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF', // on a colored segment fill
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    gap: 3,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: t.text,
  },
  rowSub: {
    fontSize: 11,
    fontWeight: '400',
    color: t.textSecondary,
  },
  rowBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.topicBg,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 5,
  },
  rowValue: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
  empty: {
    fontSize: 12,
    color: t.textTertiary,
    fontStyle: 'italic',
    paddingVertical: Spacing.three,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
