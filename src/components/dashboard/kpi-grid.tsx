// KPI card grid (spec §1) — 10 cards in a 2-column grid. Total Results shows a
// big number; the rest show an initial-avatar + name + detail. Each card has a
// divider and a colored ▲/▼ delta, and is tappable to open its Explore panel.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PLATFORM_ICON } from '@/components/author-avatar';
import { chartTokens, formatDelta } from '@/components/dashboard/palette';
import { KpiCard } from '@/data/dashboard-metrics';
import { Spacing } from '@/constants/theme';

function KpiCardView({ card, onPress }: { card: KpiCard; onPress?: () => void }) {
  const up = card.deltaPct >= 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${card.label}: ${card.value}`}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}>
      <View style={styles.labelRow}>
        {card.platform ? (
          <Image source={PLATFORM_ICON[card.platform]} style={styles.platformIcon} />
        ) : null}
        <Text style={styles.label} numberOfLines={1}>
          {card.label}
        </Text>
      </View>

      {card.isNumber ? (
        <Text style={styles.bigValue} numberOfLines={1}>
          {card.value}
        </Text>
      ) : (
        <View style={styles.nameRow}>
          {card.avatarLetter ? (
            <View style={[styles.avatar, { backgroundColor: card.avatarColor ?? '#7c3aed' }]}>
              <Text style={styles.avatarText}>{card.avatarLetter}</Text>
            </View>
          ) : null}
          <Text style={styles.name} numberOfLines={1}>
            {card.value}
          </Text>
        </View>
      )}
      {card.detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {card.detail}
        </Text>
      ) : null}

      <View style={styles.divider} />
      <Text style={[styles.delta, up ? styles.up : styles.down]}>
        {formatDelta(card.deltaPct)} {up ? '▲' : '▼'}
      </Text>
    </Pressable>
  );
}

export function KpiGrid({ cards, onCardPress }: { cards: KpiCard[]; onCardPress?: (c: KpiCard) => void }) {
  return (
    <View style={styles.grid}>
      {cards.map((c) => (
        <View key={c.key} style={styles.cell}>
          <KpiCardView card={c} onPress={onCardPress ? () => onCardPress(c) : undefined} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  // Two columns: each cell is just under half, so the row gap sits between.
  cell: {
    width: '48.5%',
    flexGrow: 1,
  },
  card: {
    backgroundColor: chartTokens.card,
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 12,
    padding: Spacing.two + 2,
    minHeight: 104,
    justifyContent: 'flex-start',
    gap: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  platformIcon: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  label: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '600',
    color: chartTokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bigValue: {
    fontSize: 30,
    fontWeight: '800',
    color: chartTokens.text,
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: chartTokens.text,
  },
  detail: {
    fontSize: 11,
    color: chartTokens.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: chartTokens.border,
    marginVertical: 6,
  },
  delta: {
    fontSize: 12,
    fontWeight: '700',
  },
  up: {
    color: '#16A34A',
  },
  down: {
    color: '#E94F37',
  },
});
