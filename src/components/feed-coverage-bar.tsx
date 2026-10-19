// A compact "coverage" strip for the Home feeds (both SharedView and
// MediaWatch): today's date and an animated count of how many items are
// available in the current (filtered) feed. View-aware via accentColor, and
// driven by whatever filtered list the screen passes in — so it stays in sync
// with the feed and works for both social posts and news articles.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(d: Date, withYear: boolean): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ''}`;
}

// Eased 0 → target tween for the count (mirrors the brief card's countUp).
function useCountUp(target: number): number {
  const [display, setDisplay] = useState(target);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const id = progress.addListener(({ value }) => setDisplay(Math.round(value * target)));
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start(() => progress.removeListener(id));
    return () => progress.removeListener(id);
  }, [target, progress]);
  return display;
}

export function FeedCoverageBar({
  items,
  noun,
  dateRange,
}: {
  items: { date: string }[];
  noun: string;
  dateRange?: { start: Date | null; end: Date | null };
}) {
  const styles = useThemedStyles(makeStyles);
  const accentColor = useAccentColor();

  // The live current date.
  const todayLabel = fmt(new Date(), true);
  const count = items.length;
  const display = useCountUp(count);

  // The window the feed is scoped to — the active date filter, or the actual
  // min–max span of the items on screen when no filter is set.
  const rangeLabel = useMemo(() => {
    let s = dateRange?.start ? dateRange.start.getTime() : null;
    let e = dateRange?.end ? dateRange.end.getTime() : null;
    if (s === null || e === null) {
      const times = items.map((i) => new Date(i.date).getTime()).filter((t) => !Number.isNaN(t));
      if (times.length === 0) return null;
      if (s === null) s = Math.min(...times);
      if (e === null) e = Math.max(...times);
    }
    const sd = new Date(s);
    const ed = new Date(e);
    const crossYear = sd.getFullYear() !== ed.getFullYear();
    return `${fmt(sd, crossYear)} → ${fmt(ed, crossYear)}`;
  }, [dateRange, items]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.block}>
          <Text style={styles.caption}>Today</Text>
          <View style={styles.rangeRow}>
            <Ionicons name="calendar-outline" size={13} color={accentColor} />
            <Text style={styles.rangeText} numberOfLines={1}>
              {todayLabel}
            </Text>
            {rangeLabel && (
              <View style={[styles.rangePill, { backgroundColor: `${accentColor}1A` }]}>
                <Text style={[styles.rangePillText, { color: accentColor }]} numberOfLines={1}>
                  {rangeLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.block, styles.blockRight]}>
          <Text style={styles.caption}>Available</Text>
          <Text style={styles.countRow}>
            <Text style={[styles.count, { color: accentColor }]}>{display}</Text>
            <Text style={styles.noun}> {count === 1 ? noun : `${noun}s`}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  card: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  block: {
    gap: 2,
    flexShrink: 1,
  },
  blockRight: {
    alignItems: 'flex-end',
  },
  caption: {
    fontSize: 10,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  rangeText: {
    fontSize: 14,
    fontWeight: '700',
    color: t.text,
    flexShrink: 1,
  },
  rangePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countRow: {
    alignItems: 'baseline',
  },
  count: {
    fontSize: 18,
    fontWeight: '800',
  },
  noun: {
    fontSize: 13,
    fontWeight: '600',
    color: t.textSecondary,
  },
});
