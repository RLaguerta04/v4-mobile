// Channel summary cards — the MediaWatch dashboard's per-media-type cards
// (web parity: #db-channels). Each card shows the medium's icon + label, a hero
// Total AVE, and a 2×2 stat block (Articles / Pub. Score / Avg Words / Story
// Value). Tapping a card drills into that medium's articles.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEDIA_TYPE_META } from '@/components/mediawatch/article-ui';
import { Spacing, Theme } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ChannelCardStat } from '@/data/article-dashboard-metrics';
import { compactAve } from '@/data/mediawatch-metrics';

export function ChannelCards({
  cards,
  onSelect,
}: {
  cards: ChannelCardStat[];
  onSelect?: (card: ChannelCardStat) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.grid}>
      {cards.map((c) => {
        const meta = MEDIA_TYPE_META[c.type];
        return (
          <Pressable
            key={c.type}
            onPress={onSelect ? () => onSelect(c) : undefined}
            disabled={!onSelect}
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityLabel={`${meta.label}: ${c.articles} articles`}
            style={({ pressed }) => [styles.card, pressed && onSelect && styles.pressed]}>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: `${meta.color}1A`, borderColor: `${meta.color}33` }]}>
                <Ionicons name={meta.icon} size={15} color={meta.color} />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {meta.label}
              </Text>
            </View>

            <Text style={styles.aveLabel}>TOTAL AVE</Text>
            <Text style={styles.aveValue} numberOfLines={1}>
              {compactAve(c.ave)}
            </Text>

            <View style={styles.statGrid}>
              <Stat label="Articles" value={String(c.articles)} />
              <Stat label="Pub. Score" value={c.pubScore.toFixed(2)} />
              <Stat label="Avg Words" value={String(c.avgWords)} />
              <Stat label="Story Value" value={c.storyValue.toFixed(2)} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 14,
    padding: Spacing.three,
    gap: 3,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: 2 },
  icon: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: t.text },
  aveLabel: { fontSize: 9, fontWeight: '600', color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  aveValue: { fontSize: 24, fontWeight: '800', color: t.text, marginBottom: Spacing.two },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: t.text },
  statLabel: { fontSize: 10, color: t.textSecondary },
});
