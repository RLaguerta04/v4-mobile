// Small shared UI atoms for the MediaWatch article surfaces (card, detail,
// tracker, publishers/authors). Kept separate so article-card and
// article-detail both import them without a circular dependency.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { Sentiment } from '@/data/types';
import type { MediaType } from '@/data/mediawatch-types';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Medium-type icon + tint + label — mirrors the web reference's `type-*`
// classes (newspaper/tv/radio/file-text/map-pin/scroll/book/rss, same colors).
export const MEDIA_TYPE_META: Record<MediaType, { icon: IoniconName; color: string; label: string }> = {
  online: { icon: 'newspaper-outline', color: '#2563EB', label: 'Online' },
  tv: { icon: 'tv-outline', color: '#7C3AED', label: 'TV' },
  radio: { icon: 'radio-outline', color: '#DB2777', label: 'Radio' },
  broadsheet: { icon: 'document-text-outline', color: '#4F46E5', label: 'Broadsheet' },
  provincial: { icon: 'location-outline', color: '#0891B2', label: 'Provincial' },
  tabloid: { icon: 'reader-outline', color: '#EA580C', label: 'Tabloid' },
  magazine: { icon: 'book-outline', color: '#C026D3', label: 'Magazine' },
  blog: { icon: 'logo-rss', color: '#D97706', label: 'Blog' },
};

export function MediaTypeIcon({ type, size = 36 }: { type: MediaType; size?: number }) {
  const meta = MEDIA_TYPE_META[type];
  return (
    <View
      style={[
        styles.typeIcon,
        { width: size, height: size, borderRadius: 10, backgroundColor: `${meta.color}1A`, borderColor: `${meta.color}33` },
      ]}>
      <Ionicons name={meta.icon} size={size * 0.46} color={meta.color} />
    </View>
  );
}

// Sentiment pill colors — the web's `.tbl-sent` palette (pos/neu/neg).
const SENTIMENT_PILL: Record<Sentiment, { bg: string; fg: string; label: string }> = {
  positive: { bg: '#E8F5EA', fg: '#16A34A', label: 'Positive' },
  neutral: { bg: 'rgba(156,163,175,0.22)', fg: '#4B5563', label: 'Neutral' },
  negative: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626', label: 'Negative' },
};

export function SentimentPill({ sentiment }: { sentiment: Sentiment }) {
  const s = SENTIMENT_PILL[sentiment];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  typeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
