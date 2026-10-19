// Small shared UI atoms for the MediaWatch article surfaces (card, detail,
// tracker, publishers/authors). Kept separate so article-card and
// article-detail both import them without a circular dependency.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Spacing } from '@/constants/theme';
import { useThemeMode } from '@/contexts/theme-context';
import type { Sentiment } from '@/data/types';
import type { MediaType, NewsArticle } from '@/data/mediawatch-types';
import { fmt, parseLength } from '@/utils/audio-clip';

// Decorative social-presence chips — a fixed brand set shown for every author /
// publisher (web parity: renderSocialIcons / MD_SOCIALS in app.js; purely visual,
// not per-entity data). Brand colors match the web's MD_SOCIALS.
const SOCIAL_BRANDS: { icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { icon: 'logo-facebook', color: '#1877F2' },
  { icon: 'logo-x', color: '#000000' },
  { icon: 'logo-instagram', color: '#E4405F' },
  { icon: 'logo-linkedin', color: '#0A66C2' },
  { icon: 'logo-youtube', color: '#FF0000' },
  { icon: 'logo-pinterest', color: '#E60023' },
  { icon: 'logo-reddit', color: '#FF4500' },
  { icon: 'logo-tiktok', color: '#111111' },
];

// A row of the brand chips — reused by the article detail's Author card and the
// Publishers/Authors detail header.
export function SocialIconRow({
  size = 26,
  gap = Spacing.two,
  style,
}: {
  size?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const iconSize = Math.round(size * 0.5);
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {SOCIAL_BRANDS.map((s) => (
        <View
          key={s.icon}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: s.color,
          }}>
          <Ionicons name={s.icon} size={iconSize} color="#FFFFFF" />
        </View>
      ))}
    </View>
  );
}

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

// AdWatch collapses every media type into one of three ad sources, each with a
// paid-placement label + icon (web parity: _AD_LABEL / _AD_ICON in app.js):
// tv → ADS - Video, print subtypes → ADS - Print, radio → ADS - Radio.
const AD_MEDIA_META: Partial<Record<MediaType, { icon: IoniconName; color: string; label: string }>> = {
  tv: { icon: 'videocam-outline', color: '#7C3AED', label: 'ADS - Video' },
  radio: { icon: 'radio-outline', color: '#DB2777', label: 'ADS - Radio' },
  broadsheet: { icon: 'print-outline', color: '#4F46E5', label: 'ADS - Print' },
  provincial: { icon: 'print-outline', color: '#4F46E5', label: 'ADS - Print' },
  tabloid: { icon: 'print-outline', color: '#4F46E5', label: 'ADS - Print' },
  magazine: { icon: 'print-outline', color: '#4F46E5', label: 'ADS - Print' },
};

// The medium's icon/tint/label for a given workspace — the ad override in
// AdWatch (adMode), the plain MediaWatch meta otherwise.
export function mediaMeta(type: MediaType, adMode = false): { icon: IoniconName; color: string; label: string } {
  return (adMode && AD_MEDIA_META[type]) || MEDIA_TYPE_META[type];
}

// Mix a hex color toward white by `amt` (0..1) — lightens a media-type hue so
// it stays legible as an icon on the dark card.
function lightenHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (255 - c) * amt)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export function MediaTypeIcon({ type, size = 36, adMode = false }: { type: MediaType; size?: number; adMode?: boolean }) {
  const meta = mediaMeta(type, adMode);
  const { isDark } = useThemeMode();
  // On the dark card a 10% tint is nearly invisible and the blue/purple hues
  // are dim, so in dark use a stronger tint + border and a lightened icon so
  // each chip clearly pops. Light keeps the original subtle tint.
  const bg = isDark ? `${meta.color}33` : `${meta.color}1A`;
  const border = isDark ? `${meta.color}59` : `${meta.color}33`;
  const iconColor = isDark ? lightenHex(meta.color, 0.3) : meta.color;
  return (
    <View
      style={[
        styles.typeIcon,
        { width: size, height: size, borderRadius: 10, backgroundColor: bg, borderColor: border },
      ]}>
      <Ionicons name={meta.icon} size={size * 0.46} color={iconColor} />
    </View>
  );
}

// Sentiment pill colors — the web's `.tbl-sent` palette (pos/neu/neg). Light
// keeps the exact web tints; dark uses translucent-accent fills with the
// lightened on-dark text so the pills (esp. the neutral grey) stay legible.
const SENTIMENT_PILL: Record<
  Sentiment,
  { label: string; light: { bg: string; fg: string }; dark: { bg: string; fg: string } }
> = {
  positive: { label: 'Positive', light: { bg: '#E8F5EA', fg: '#16A34A' }, dark: { bg: 'rgba(34,197,94,0.16)', fg: '#22C55E' } },
  neutral: { label: 'Neutral', light: { bg: 'rgba(156,163,175,0.22)', fg: '#4B5563' }, dark: { bg: 'rgba(255,255,255,0.10)', fg: '#9CA0A8' } },
  negative: { label: 'Negative', light: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626' }, dark: { bg: 'rgba(255,107,91,0.16)', fg: '#FF6B5B' } },
};

export function SentimentPill({ sentiment }: { sentiment: Sentiment }) {
  const { isDark } = useThemeMode();
  const s = SENTIMENT_PILL[sentiment];
  const c = isDark ? s.dark : s.light;
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{s.label}</Text>
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
        // Nested inside the card's tap-to-open Pressable, which is a
        // role="button" (react-native-web renders it as a <button>). Deliberately
        // NO accessibilityRole here: a second role="button" would nest one
        // <button> inside another — invalid HTML on web. stopPropagation still
        // keeps a tap from bubbling up and opening the article detail.
        onPress={(e) => {
          e.stopPropagation();
          toggle();
        }}
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

// Deterministic faux-newsprint column widths — ragged like real body text.
const CLIP_COLS: `${number}%`[][] = [
  ['100%', '92%', '64%'],
  ['96%', '100%', '78%'],
  ['100%', '85%', '58%'],
];

// "Paper" palette for the clipping. Light = real newsprint cream; dark inverts
// to a warm dark newsprint with light ink, so it reads as a clipping at night
// instead of a glaring white block on the dark card.
const PAPER = {
  light: { bg: '#EFEAE0', border: '#DAD3C4', ink: '#2B2A26', line: '#CFC9BC', foot: '#8A857A' },
  dark: { bg: '#2A2824', border: '#3A362F', ink: '#E8E3D8', line: '#46423A', foot: '#9A948A' },
};

// Print's card/detail attachment. There's no real scanned page in this
// prototype, so we GENERATE a newspaper-clipping preview from the article's own
// data — a serif masthead + headline, faint column rules, and a "PAGE N" tab —
// to evoke a broadsheet scan instead of a flat page chip. It's fixed "paper"
// colours (a scan reads the same in light and dark). Pass `onPress` (detail
// view) to open the real file when one is attached.
export function DocumentAttachment({
  article,
  onPress,
}: {
  article: Pick<NewsArticle, 'mediaType' | 'page' | 'outlet' | 'title' | 'section'>;
  onPress?: () => void;
}) {
  const meta = MEDIA_TYPE_META[article.mediaType];
  const { isDark } = useThemeMode();
  const p = isDark ? PAPER.dark : PAPER.light;
  const clip = (
    <View style={[styles.clip, { backgroundColor: p.bg, borderColor: p.border }]}>
      <View style={styles.clipMast}>
        <Text style={[styles.clipOutlet, { color: p.ink }]} numberOfLines={1}>
          {article.outlet}
        </Text>
      </View>
      <View style={[styles.clipRule, { backgroundColor: p.ink }]} />
      <Text style={[styles.clipHeadline, { color: p.ink }]} numberOfLines={2}>
        {article.title}
      </Text>
      <View style={styles.clipCols}>
        {CLIP_COLS.map((widths, c) => (
          <View key={c} style={styles.clipCol}>
            {widths.map((w, r) => (
              <View key={r} style={[styles.clipLine, { width: w, backgroundColor: p.line }]} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.clipFootRow}>
        <Text style={[styles.clipFooter, { color: p.foot }]} numberOfLines={1}>
          {article.section} · {meta.label}
        </Text>
        {onPress && (
          <View style={styles.clipOpen}>
            <Ionicons name="scan-outline" size={11} color={meta.color} />
            <Text style={[styles.clipOpenText, { color: meta.color }]}>Open page</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (!onPress) return clip;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={article.page ? `Preview page ${article.page}` : 'Preview print clipping'}
      style={({ pressed }) => pressed && styles.attachmentPressed}>
      {clip}
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
  // ── Newspaper-clipping preview (print attachment) — fixed "paper" colours ──
  clip: {
    alignSelf: 'stretch',
    backgroundColor: '#EFEAE0', // newsprint cream
    borderWidth: 1,
    borderColor: '#DAD3C4',
    borderRadius: Spacing.two,
    padding: 10,
    gap: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  clipMast: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  clipOutlet: {
    flexShrink: 1,
    fontFamily: Fonts.serif,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#2B2A26', // newsprint ink
    textTransform: 'uppercase',
  },
  clipRule: { height: 1, backgroundColor: '#2B2A26', opacity: 0.85 },
  clipHeadline: { fontFamily: Fonts.serif, fontSize: 15, fontWeight: '700', lineHeight: 19, color: '#2B2A26' },
  clipCols: { flexDirection: 'row', gap: 10, marginTop: 1 },
  clipCol: { flex: 1, gap: 4 },
  clipLine: { height: 3, borderRadius: 1.5, backgroundColor: '#CFC9BC' },
  clipFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: 1 },
  clipFooter: { flexShrink: 1, fontSize: 9.5, fontWeight: '600', letterSpacing: 0.3, color: '#8A857A', textTransform: 'uppercase' },
  clipOpen: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clipOpenText: { fontSize: 10, fontWeight: '700' },
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
