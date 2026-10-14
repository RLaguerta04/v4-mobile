// Shared chrome for every Dashboard chart section — the white rounded card
// with a title (+ info icon) and the optional "Insights" / "Explore Data"
// actions from the web's .db-card-hd, plus a legend row and a hook that
// measures the card's inner width so SVG charts can size to the phone.
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { chartTokens } from '@/components/dashboard/palette';

// Measure a container's width via onLayout. Charts render at a sensible
// fallback on first paint, then snap to the real width once measured.
export function useMeasuredWidth(fallback = 320): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(fallback);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w);
  }, [width]);
  return [width, onLayout];
}

// Fixed-height box that measures its own width so an SVG chart can fill it.
export function ChartArea({ height, children }: { height: number; children: (w: number) => ReactNode }) {
  const [w, onLayout] = useMeasuredWidth(320);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {children(w)}
    </View>
  );
}

export function DbCard({
  title,
  onExplore,
  onInsights,
  children,
  style,
}: {
  title: string;
  onExplore?: () => void;
  onInsights?: () => void;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Ionicons name="information-circle-outline" size={14} color={chartTokens.textSecondary} />
        </View>
        {(onInsights || onExplore) && (
          <View style={styles.actions}>
            {onInsights && (
              <Pressable
                onPress={onInsights}
                accessibilityRole="button"
                accessibilityLabel={`${title} insights`}
                hitSlop={6}
                style={({ pressed }) => [styles.insightsBtn, pressed && styles.pressed]}>
                <Ionicons name="sparkles" size={12} color={chartTokens.text} />
                <Text style={styles.insightsText}>Insights</Text>
              </Pressable>
            )}
            {onExplore && (
              <Pressable
                onPress={onExplore}
                accessibilityRole="button"
                accessibilityLabel={`Explore ${title} data`}
                hitSlop={6}
                style={({ pressed }) => [styles.exploreBtn, pressed && styles.pressed]}>
                <Text style={styles.exploreText}>Explore</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

export type LegendItem = { label: string; color: string; note?: string };

export function Legend({ items, style }: { items: LegendItem[]; style?: object }) {
  return (
    <View style={[styles.legend, style]}>
      {items.map((it, i) => (
        <View key={`${it.label}-${i}`} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text style={styles.legendLabel} numberOfLines={1}>
            {it.label}
            {it.note ? <Text style={styles.legendNote}>  {it.note}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Segmented range control (3D / 7D / 15D / 1M) used by the Timeline card.
export function RangeToggle<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.rangeRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.rangeBtn, on && styles.rangeBtnOn]}>
            <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: chartTokens.card,
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: chartTokens.text,
    letterSpacing: -0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 0,
  },
  insightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  insightsText: {
    fontSize: 11,
    fontWeight: '600',
    color: chartTokens.text,
  },
  exploreBtn: {
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  exploreText: {
    fontSize: 11,
    fontWeight: '600',
    color: chartTokens.text,
  },
  pressed: {
    opacity: 0.6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: chartTokens.textSecondary,
    flexShrink: 1,
  },
  legendNote: {
    fontSize: 11,
    color: chartTokens.axisText,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  rangeBtn: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F2F1ED',
  },
  rangeBtnOn: {
    backgroundColor: '#1A1A1A',
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: chartTokens.textSecondary,
  },
  rangeTextOn: {
    color: '#FFFFFF',
  },
});
