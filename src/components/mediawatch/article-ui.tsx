// Small shared UI atoms for the MediaWatch article surfaces (card, detail,
// tracker, publishers/authors). Kept separate so article-card and
// article-detail both import them without a circular dependency.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import type { Sentiment } from '@/data/types';
import type { MediaType, NewsArticle } from '@/data/mediawatch-types';
import { fmt, parseLength } from '@/utils/audio-clip';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Medium-type icon + tint + label — mirrors the web reference's `type-*`
// classes (newspaper/tv/radio/file-text/map-pin/scroll/book/rss, same colors).
export const MEDIA_TYPE_META: Record<MediaType, { icon: IoniconName; color: string; label: string }> = {
  online: { icon: 'newspaper-outline', color: '#2563EB', label: 'Online' },
  tv: { icon: 'tv-outline', color: '#7C3AED', label: 'TV' },
  radio: { icon: 'radio-outline', color: '#DB2777', label: 'Radio' },
  broadsheet: { icon: 'document-text-outline', color: '#4F46E5', label: 'Broadsheet' },
  provincial: { icon: 'location-outline', color: '#0891B2', label: 'Provincial' },
  tabloid: { icon: 'receipt-outline', color: '#EA580C', label: 'Tabloid' },
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

// Deterministic "static" bar heights for the radio attachment's decorative
// waveform — seeded from the article id so bars stay put across re-renders.
// Purely presentational; there's no audio engine behind it.
export function buildWaveform(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let s = h || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: count }, () => 0.22 + rnd() * 0.78);
}

// Radio's compact card player — every radio pickup is an aired clip, so this
// always renders. There's no real audio, so playback is simulated like the
// detail hero: tapping play sweeps a white playhead knob across the waveform,
// reveals the solid "played" bars over the dimmer remainder, and counts the
// time up. Muted mauve-grey keeps it subtle in the feed.
const AUDIO_BARS = 32;
const AUDIO_COLOR = '#9E7B8C';

// Both the dim base and the solid "played" copy render identical bar heights
// (same seed) so they line up exactly when the played copy is clipped over it.
function AudioBars({ bars, color }: { bars: number[]; color: string }) {
  return (
    <View style={styles.waveBarsRow}>
      {bars.map((h, i) => (
        <View key={i} style={[styles.waveformBar, { height: `${40 + h * 60}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function AudioAttachment({ article }: { article: Pick<NewsArticle, 'id' | 'length'> }) {
  const bars = useMemo(() => buildWaveform(article.id, AUDIO_BARS), [article.id]);
  const total = useMemo(() => parseLength(article.length), [article.length]);
  const totalMs = total * 1000;

  const [waveW, setWaveW] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [posSec, setPosSec] = useState(0);
  const progress = useSharedValue(0);

  useAnimatedReaction(
    () => Math.floor(progress.value * total),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setPosSec)(cur);
    },
    [total],
  );

  function toggle() {
    if (playing) {
      cancelAnimation(progress);
      setPlaying(false);
      return;
    }
    if (progress.value >= 1) progress.value = 0;
    const remainingMs = (1 - progress.value) * totalMs;
    setPlaying(true);
    progress.value = withTiming(1, { duration: remainingMs, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(setPlaying)(false);
    });
  }

  const playedStyle = useAnimatedStyle(() => ({ width: progress.value * waveW }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * waveW }],
    opacity: waveW > 0 && progress.value > 0.002 ? 1 : 0,
  }));

  return (
    <View style={[styles.attachment, { backgroundColor: `${AUDIO_COLOR}14`, borderColor: `${AUDIO_COLOR}33` }]}>
      <Pressable
        // Nested inside the card's tap-to-open Pressable — stop the press here
        // so playing never also opens the article detail.
        onPress={(e) => {
          e.stopPropagation();
          toggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause clip' : 'Play clip'}
        hitSlop={8}
        style={({ pressed }) => [
          styles.attachmentPlayDot,
          { backgroundColor: AUDIO_COLOR },
          pressed && styles.attachmentPressed,
        ]}>
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={10}
          color="#FFFFFF"
          style={playing ? undefined : styles.attachmentPlayGlyph}
        />
      </Pressable>
      <View style={styles.waveform} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
        <View style={StyleSheet.absoluteFill}>
          <AudioBars bars={bars} color={`${AUDIO_COLOR}59`} />
        </View>
        <Animated.View style={[styles.wavePlayed, playedStyle]}>
          <View style={{ width: waveW, height: '100%' }}>
            <AudioBars bars={bars} color={AUDIO_COLOR} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.wavePlayhead, headStyle]} />
      </View>
      <Text style={[styles.attachmentLabel, { color: AUDIO_COLOR, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
        {playing || posSec > 0 ? fmt(posSec) : (article.length ?? fmt(total))}
      </Text>
    </View>
  );
}

// Print's card/detail attachment — every clipping ran on a physical page, so
// this always renders. No scanned-page image in this prototype, just a page
// reference chip. Pass `onPress` (detail view only — the card's chip sits
// inside the card's own tappable area, so it stays a plain, non-nested View)
// to make it open the real file when one is actually attached.
export function DocumentAttachment({
  article,
  onPress,
}: {
  article: Pick<NewsArticle, 'mediaType' | 'page'>;
  onPress?: () => void;
}) {
  const meta = MEDIA_TYPE_META[article.mediaType];
  const content = (
    <>
      <Ionicons name="document-text-outline" size={15} color={meta.color} />
      <Text style={[styles.attachmentLabel, { color: meta.color }]} numberOfLines={1}>
        {article.page ? `Page ${article.page}` : 'Print clipping'}
      </Text>
      {onPress && <Ionicons name="chevron-forward" size={14} color={meta.color} style={styles.attachmentChevron} />}
    </>
  );
  const colorStyle = { backgroundColor: `${meta.color}14`, borderColor: `${meta.color}33` };

  if (!onPress) return <View style={[styles.attachment, colorStyle]}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={article.page ? `Preview page ${article.page}` : 'Preview print clipping'}
      style={({ pressed }) => [styles.attachment, colorStyle, pressed && styles.attachmentPressed]}>
      {content}
    </Pressable>
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
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    height: 34,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  attachmentPlayDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPlayGlyph: {
    marginLeft: 1,
  },
  attachmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  waveform: {
    flex: 1,
    height: 18,
    position: 'relative',
    justifyContent: 'center',
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: '100%',
    width: '100%',
  },
  waveformBar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1.5,
  },
  // The solid "played" copy, clipped to [0, progress·width] over the dim base.
  wavePlayed: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  // White knob riding the playhead edge (translated by progress) — the compact
  // echo of the hero player's playhead. Hidden until playback starts.
  wavePlayhead: {
    position: 'absolute',
    top: '50%',
    left: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: -3.5,
    marginLeft: -3.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: AUDIO_COLOR,
  },
  attachmentChevron: {
    marginLeft: -2,
  },
  attachmentPressed: {
    opacity: 0.6,
  },
});
