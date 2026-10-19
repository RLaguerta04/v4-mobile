// Generic detail-view building blocks shared by the SharedView social post
// detail (mention-card.tsx) and the MediaWatch article detail
// (mediawatch/article-detail.tsx). Pure presentational pieces with no
// dependency on either data source, so both workspaces reuse them without
// duplicating markup/styles. Extracted from mention-card.tsx (no behavior
// change).
import { Feather, Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaMeterColors, Spacing, Theme } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { ArticleTone, Sentiment } from '@/data/types';

type IoniconName = keyof typeof Ionicons.glyphMap;
type FeatherName = keyof typeof Feather.glyphMap;

// Shared card palette — the warm Media Meter surface tokens. Kept as a static
// (light) object for screens not yet migrated to the theme system; migrated
// components should call useCardPalette() so the values flip in dark mode.
export const cardPalette = {
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  track: '#EDE6D8',
};

// The scheme-aware equivalent of `cardPalette` — same keys, resolved from the
// active theme. Drop-in replacement inside a component: `const cp = useCardPalette()`.
export function useCardPalette() {
  const t = useTheme();
  return { card: t.card, text: t.text, textSecondary: t.textSecondary, border: t.border, track: t.track };
}

// Real Media Meter v4 sentiment tokens (design-system.html), not guessed values.
export const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: MediaMeterColors.positive,
  neutral: MediaMeterColors.neutralSentiment,
  negative: MediaMeterColors.negative,
};

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

// Bordered white card wrapping one detail section; optional uppercase label.
export function DetailCard({ label, children }: { label?: string; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.detailCard}>
      {label && <Text style={styles.detailCardLabel}>{label}</Text>}
      {children}
    </View>
  );
}

// Two side-by-side stat tiles with a divider (e.g. Estimated Reach / Engagement
// Score, or Story Value / AVE).
export function StatTiles({
  left,
  right,
}: {
  left: { label: string; value: string | number };
  right: { label: string; value: string | number };
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tilesRow}>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>{left.label}</Text>
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {left.value}
        </Text>
      </View>
      <View style={styles.tileDivider} />
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>{right.label}</Text>
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
          {right.value}
        </Text>
      </View>
    </View>
  );
}

export type SelectorOption<T extends string> = {
  value: T;
  icon: FeatherName;
  label: string;
  color: string;
};

// Brand Sentiment (faces) and Article Tone (thumbs) — the two 3-way selectors
// from the web article/social panel. "Neutral/Mixed" is the middle option.
export const BRAND_OPTIONS: SelectorOption<Sentiment>[] = [
  { value: 'positive', icon: 'smile', label: 'Good for Brand', color: MediaMeterColors.positive },
  { value: 'neutral', icon: 'meh', label: 'Neutral', color: MediaMeterColors.neutralSentiment },
  { value: 'negative', icon: 'frown', label: 'Bad for Brand', color: MediaMeterColors.negative },
];

export const TONE_OPTIONS: SelectorOption<ArticleTone>[] = [
  { value: 'positive', icon: 'thumbs-up', label: 'Positive Tone', color: MediaMeterColors.positive },
  { value: 'mixed', icon: 'minus', label: 'Neutral Tone', color: MediaMeterColors.neutralSentiment },
  { value: 'negative', icon: 'thumbs-down', label: 'Negative Tone', color: MediaMeterColors.negative },
];

// Three-way icon selector shared by Brand Sentiment and Post/Article Tone.
// Tapping updates local state only — the manual-override feel of the web panel.
export function TriSelector<T extends string>({
  options,
  initial,
}: {
  options: SelectorOption<T>[];
  initial?: T;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const [value, setValue] = useState<T | undefined>(initial);
  const active = options.find((o) => o.value === value);
  return (
    <View style={styles.selectorRow}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => setValue(o.value)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[styles.selectorBtn, on && { borderColor: o.color, backgroundColor: `${o.color}1A` }]}>
            <Feather name={o.icon} size={20} color={on ? o.color : theme.textSecondary} />
          </Pressable>
        );
      })}
      <Text style={[styles.selectorLabel, active ? { color: active.color } : null]}>
        {active ? active.label : 'Not set'}
      </Text>
    </View>
  );
}

// Keyword pills ("term - count").
export function KeywordPills({ keywords }: { keywords: [string, number][] }) {
  const styles = useThemedStyles(makeStyles);
  const { isDark } = useThemeMode();
  // Lilac #6B4DE8 is too dim as text on the dark canvas (~3.9:1) — use the
  // lightened lilac for dark so the keyword label stays legible.
  const kwColor = isDark ? '#A78BFA' : '#6B4DE8';
  return (
    <View style={styles.pillWrap}>
      {keywords.map(([term, count], i) => (
        <View key={i} style={styles.kwPill}>
          <Text style={[styles.kwPillText, { color: kwColor }]}>
            {term} - {count}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Entity pill styling by inferred type — mirrors the web's typed entity chips.
const ENTITY_META: Record<'org' | 'person' | 'location' | 'other', { icon: IoniconName; color: string }> = {
  org: { icon: 'business-outline', color: '#0D9488' },
  person: { icon: 'person-outline', color: '#2563EB' },
  location: { icon: 'location-outline', color: '#D97706' },
  other: { icon: 'pricetag-outline', color: '#6B7280' },
};

function entityType(name: string): keyof typeof ENTITY_META {
  if (/\b(City|Visayas|Luzon|Mindanao|Philippines|Manila|Cebu|Davao|Cavite|Baguio|La Union|Iloilo)\b/i.test(name)) {
    return 'location';
  }
  if (
    /\b(Inc|Corp|Communications?|Telecommunity|Labs?|Electric|Networks?|PLDT|DITO|Globe|Smart|Telecom|Mobile|Tesla|BYD|Toyota|Hyundai|Kia|Geely|GWM|ACMobility|Shell|Energy|Department)\b/i.test(
      name,
    )
  ) {
    return 'org';
  }
  if (/^[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+$/.test(name)) return 'person';
  // Default to 'org' (teal) like the web — no gray fallback, so product/topic
  // entities get a colored icon instead of a muted one.
  return 'org';
}

// Entity pills with typed icon; first `limit` shown, rest behind "Show all N".
export function EntityPills({ entities, limit = 5 }: { entities: string[]; limit?: number }) {
  const styles = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entities : entities.slice(0, limit);
  const remaining = entities.length - limit;

  return (
    <View style={styles.pillWrap}>
      {shown.map((name, i) => {
        const meta = ENTITY_META[entityType(name)];
        return (
          <View key={i} style={styles.entPill}>
            <View style={[styles.entIcon, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={11} color="#FFFFFF" />
            </View>
            <Text style={styles.entPillText}>{name}</Text>
          </View>
        );
      })}
      {!expanded && remaining > 0 && (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.entMore, pressed && styles.pressed]}>
          <Text style={styles.entMoreText}>Show all {entities.length}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  pressed: {
    opacity: 0.5,
  },
  detailCard: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  detailCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.one,
  },
  tilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    flex: 1,
    gap: 2,
  },
  tileDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.border,
    marginHorizontal: Spacing.three,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tileValue: {
    fontSize: 26,
    fontWeight: '700',
    color: t.text,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selectorBtn: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: t.textSecondary,
    marginLeft: Spacing.one,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  // Keyword pill — web's lilac tint (md-kw-pill): B9A4F7 at 15% fill / 30% border.
  kwPill: {
    backgroundColor: 'rgba(185, 164, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(185, 164, 247, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  kwPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B4DE8',
  },
  // Entity pill — web's canvas pill (md-ent-pill): off-white fill, light border.
  entPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: t.topicBg,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 20,
    paddingLeft: 4,
    paddingRight: 11,
    paddingVertical: 3,
  },
  entIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: t.text,
  },
  entMore: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  entMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
  },
});
