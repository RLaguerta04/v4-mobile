// Radio "hero" audio player — the rich, web-style maroon player used on the
// article detail, and (via the `compact` prop) as the feed card's radio
// thumbnail too. There's no real audio engine, so playback is simulated: tapping
// play sweeps a playhead across the waveform, reveals the "played" (bright) bars
// over the dim base, and ticks a time counter — driven by a single Reanimated
// progress value so the visual and the clock never drift apart.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

import { buildWaveform } from '@/components/mediawatch/article-ui';
import { Spacing } from '@/constants/theme';
import type { NewsArticle } from '@/data/mediawatch-types';
import { fmt, parseLength } from '@/utils/audio-clip';

const WAVE_BARS = 56;
// Warm orange-red play accent + maroon gradient, matching the web player.
const ACCENT = '#F15A2B';
const GRADIENT: readonly [string, string] = ['#7B1E42', '#43102A'];

// One pass of equal-flex bars; both the dim base and the bright "played" copy
// render identical heights (same seed) so they line up exactly when layered.
function Bars({ bars, color }: { bars: number[]; color: string }) {
  return (
    <View style={styles.bars}>
      {bars.map((h, i) => (
        <View key={i} style={[styles.bar, { height: `${20 + h * 80}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function AudioHeroPlayer({
  article,
  compact = false,
}: {
  article: Pick<NewsArticle, 'id' | 'outlet' | 'length' | 'ago'>;
  compact?: boolean;
}) {
  const bars = useMemo(() => buildWaveform(article.id, WAVE_BARS), [article.id]);
  const total = useMemo(() => parseLength(article.length), [article.length]);
  const totalMs = total * 1000;

  const [waveW, setWaveW] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [posSec, setPosSec] = useState(0);
  const progress = useSharedValue(0);

  // Keep the clock in lockstep with the actual animation: fire only when the
  // whole-second value changes, so no separate timer can drift out of sync.
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

  // The played copy is clipped to [0, progress·width]; the playhead rides the
  // same edge. Both run on the UI thread — no re-render per frame.
  const playedStyle = useAnimatedStyle(() => ({ width: progress.value * waveW }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * waveW }] }));

  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, compact && styles.heroCompact]}>
      <View style={styles.top}>
        <Pressable
          onPress={(e) => {
            // On the feed card this player is nested inside the card's
            // tap-to-open button; stop the tap from also opening the article,
            // and skip the nested role="button" (invalid HTML on web).
            if (compact) e.stopPropagation();
            toggle();
          }}
          accessibilityRole={compact ? undefined : 'button'}
          accessibilityLabel={playing ? 'Pause clip' : 'Play clip'}
          style={({ pressed }) => [styles.playBtn, compact && styles.playBtnCompact, pressed && styles.pressed]}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={compact ? 18 : 22}
            color="#FFFFFF"
            style={playing ? undefined : styles.playGlyph}
          />
        </Pressable>
        <View style={styles.station}>
          <Text style={styles.stationText} numberOfLines={1}>
            {article.outlet}
          </Text>
        </View>
        <View style={styles.spacer} />
        <Text style={styles.ago}>{article.ago}</Text>
      </View>

      <View style={[styles.waveRow, compact && styles.waveRowCompact]} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
        <View style={StyleSheet.absoluteFill}>
          <Bars bars={bars} color="rgba(255,255,255,0.28)" />
        </View>
        <Animated.View style={[styles.playedClip, playedStyle]}>
          <View style={{ width: waveW, height: '100%' }}>
            <Bars bars={bars} color="#FFFFFF" />
          </View>
        </Animated.View>
        {waveW > 0 && <Animated.View style={[styles.playhead, headStyle]} />}
      </View>

      <View style={styles.bottom}>
        <View style={styles.timeNow}>
          <Text style={styles.timeNowText}>{fmt(posSec)}</Text>
        </View>
        <View style={styles.timeTotal}>
          <Text style={styles.timeTotalText}>{fmt(total)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  playGlyph: { marginLeft: 3 },
  pressed: { opacity: 0.8 },
  // Compact (feed-card) overrides — same look, smaller footprint.
  heroCompact: { padding: Spacing.two + 2, gap: Spacing.two },
  playBtnCompact: { width: 40, height: 40, borderRadius: 20 },
  waveRowCompact: { height: 56 },
  station: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
    maxWidth: '45%',
  },
  stationText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  spacer: { flex: 1 },
  ago: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
  },
  waveRow: {
    height: 120,
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    width: '100%',
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 2,
  },
  playedClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeNow: {
    backgroundColor: ACCENT,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeNowText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  timeTotal: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeTotalText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    fontVariant: ['tabular-nums'],
  },
});
