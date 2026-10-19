// Synced Transcript theater — a full-screen reader for a broadcast (TV/radio)
// article whose transcript plays in time with the clip. There's no real media
// engine, so playback is simulated with a single Reanimated `progress` clock;
// each sentence gets a time window weighted by its word count. The active
// sentence highlights, its words sweep karaoke-style, and it auto-scrolls.
//
// Perf notes (why it's built this way):
//  • ONE useAnimatedReaction with STABLE deps drives posSec + active sentence +
//    current word (packed into a single number). A per-sentence reaction would
//    re-subscribe every sentence and churn render — the source of the stutter
//    and the "[Reanimated] reading .value during render" warning.
//  • The player is pinned at full size above the transcript — no scroll-coupled
//    layout, so scrolling the transcript never thrashes the player's layout.
//  • Each transcript line is memoised; only the active line re-renders per word.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated as RNAnimated,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { NewsArticle } from '@/data/mediawatch-types';
import { fmt, parseLength } from '@/utils/audio-clip';

const GRADIENT: readonly [string, string] = ['#7B1E42', '#43102A'];
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

type Sentence = { text: string; words: string[]; start: number; dur: number; end: number };

// Split the transcript into sentences, each a slice of the duration weighted by
// its word count (≈ a steady reading cadence). Deterministic.
function buildTiming(transcript: string, dur: number): Sentence[] {
  const raw = (transcript.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [transcript])
    .map((s) => s.trim())
    .filter(Boolean);
  const parts = raw.map((t) => ({ text: t, words: t.split(/\s+/) }));
  const totalW = parts.reduce((a, p) => a + p.words.length, 0) || 1;
  let acc = 0;
  return parts.map((p) => {
    const d = (p.words.length / totalW) * dur;
    const s: Sentence = { text: p.text, words: p.words, start: acc, dur: d, end: acc + d };
    acc = s.end;
    return s;
  });
}

// ── Memoised transcript line — only the active line re-renders per word ──
type LineState = 'active' | 'played' | 'upcoming';
const TranscriptLine = memo(function TranscriptLine({
  index,
  words,
  text,
  state,
  curWord,
  accent,
  isMatch,
  onSeek,
  onMeasure,
}: {
  index: number;
  words: string[];
  text: string;
  state: LineState;
  curWord: number;
  accent: string;
  isMatch: boolean;
  onSeek: (i: number) => void;
  onMeasure: (i: number, y: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onLayout={(e) => onMeasure(index, e.nativeEvent.layout.y)}
      onPress={() => onSeek(index)}
      accessibilityRole="button"
      accessibilityLabel={`Jump to: ${text}`}
      style={[
        styles.sentence,
        state === 'active' && { backgroundColor: `${accent}14` },
        isMatch && styles.sentenceMatch,
      ]}>
      {state === 'active' ? (
        <Text style={styles.sentenceText}>
          {words.map((w, wi) => (
            <Text
              key={wi}
              style={
                wi < curWord
                  ? styles.wSpoken
                  : wi === curWord
                    ? [styles.wCurrent, { color: accent, backgroundColor: `${accent}38` }]
                    : styles.wAhead
              }>
              {w}
              {wi < words.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      ) : (
        <Text style={[styles.sentenceText, state === 'played' ? styles.played : styles.upcoming]}>{text}</Text>
      )}
    </Pressable>
  );
});

type TheaterArticle = Pick<
  NewsArticle,
  'id' | 'outlet' | 'program' | 'segment' | 'length' | 'aired' | 'transcript' | 'mediaType' | 'thumbnail'
>;

export function SyncedTranscriptTheater({
  article,
  onClose,
}: {
  article: TheaterArticle;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accentColor = useAccentColor();
  const isVideo = article.mediaType === 'tv';
  const dismiss = useDismissGesture(onClose);

  const total = useMemo(() => parseLength(article.length), [article.length]);
  const totalMs = total * 1000;
  const sentences = useMemo(() => buildTiming(article.transcript ?? '', total), [article.transcript, total]);
  const starts = useMemo(() => sentences.map((s) => s.start), [sentences]);
  const ends = useMemo(() => sentences.map((s) => s.end), [sentences]);
  const wordCounts = useMemo(() => sentences.map((s) => s.words.length), [sentences]);
  const bars = useMemo(() => buildWaveform(article.id, 48), [article.id]);

  const progress = useSharedValue(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [posSec, setPosSec] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [barW, setBarW] = useState(0);
  const [waveW, setWaveW] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number[]>([]);
  const [matchPos, setMatchPos] = useState(0);
  const [copied, setCopied] = useState(false);
  // Lifts the floating search bar above the keyboard while it's open.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const yMap = useRef<Record<number, number>>({});
  const viewH = useRef(0);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One reaction, STABLE deps: clock → seconds + active sentence + current word,
  // packed into a single number so it fires only when something actually changes.
  useAnimatedReaction(
    () => {
      const cur = progress.get() * total;
      if (ends.length === 0) return 0;
      const sec = Math.floor(cur);
      let i = ends.length - 1;
      for (let k = 0; k < ends.length; k++) {
        if (cur < ends[k]) {
          i = k;
          break;
        }
      }
      const span = ends[i] - starts[i] || 1;
      let wi = Math.floor(((cur - starts[i]) / span) * wordCounts[i]);
      if (wi < 0) wi = 0;
      else if (wi >= wordCounts[i]) wi = wordCounts[i] - 1;
      return sec * 1000000 + i * 1000 + wi;
    },
    (packed, prev) => {
      if (packed === prev) return;
      runOnJS(setPosSec)(Math.floor(packed / 1000000));
      runOnJS(setActiveIndex)(Math.floor((packed % 1000000) / 1000));
      runOnJS(setWordIndex)(packed % 1000);
    },
    [starts, ends, wordCounts, total],
  );

  function playFrom(from: number, spd: number) {
    const remainingMs = ((1 - from) * totalMs) / spd;
    progress.set(withTiming(1, { duration: Math.max(0, remainingMs), easing: Easing.linear }, (fin) => {
      if (fin) runOnJS(setPlaying)(false);
    }));
  }

  function toggle() {
    if (playing) {
      cancelAnimation(progress);
      setPlaying(false);
      return;
    }
    if (progress.get() >= 1) progress.set(0);
    setPlaying(true);
    playFrom(progress.get(), speed);
  }

  function seek(sec: number) {
    cancelAnimation(progress);
    const v = Math.max(0, Math.min(1, sec / total));
    progress.set(v);
    setPosSec(Math.floor(v * total));
    if (playing) playFrom(v, speed);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (playing) {
      cancelAnimation(progress);
      playFrom(progress.get(), next);
    }
  }

  function scrubAt(x: number) {
    cancelAnimation(progress);
    const v = barW > 0 ? Math.max(0, Math.min(1, x / barW)) : 0;
    progress.set(v);
    setPosSec(Math.floor(v * total));
  }
  function scrubRelease() {
    if (playing) playFrom(progress.get(), speed);
  }

  function scrollToActive(i: number) {
    const y = yMap.current[i];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - viewH.current * 0.33), animated: true });
    }
  }

  useEffect(() => {
    if (auto) scrollToActive(activeIndex);
  }, [activeIndex, auto]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  function resumeAuto() {
    setAuto(true);
    scrollToActive(activeIndex);
  }

  // Stable callbacks so memoised lines don't re-render on identity churn. The
  // ref is refreshed in an effect (never during render) to capture latest state.
  const seekRef = useRef<(i: number) => void>(() => {});
  useEffect(() => {
    seekRef.current = (i: number) => {
      seek(sentences[i].start + 0.01);
      resumeAuto();
    };
  });
  const handleSeek = useCallback((i: number) => seekRef.current(i), []);
  const handleMeasure = useCallback((i: number, y: number) => {
    yMap.current[i] = y;
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      setKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [searchOpen]);

  function runSearch(q: string) {
    setQuery(q);
    const s = q.trim().toLowerCase();
    const m: number[] = [];
    if (s) sentences.forEach((sen, i) => s && sen.text.toLowerCase().includes(s) && m.push(i));
    setMatches(m);
    setMatchPos(0);
    if (m.length) {
      seek(sentences[m[0]].start + 0.01);
      resumeAuto();
    }
  }
  function gotoMatch(d: number) {
    if (!matches.length) return;
    const p = (matchPos + d + matches.length) % matches.length;
    setMatchPos(p);
    seek(sentences[matches[p]].start + 0.01);
    resumeAuto();
  }
  function closeSearch() {
    Keyboard.dismiss();
    setSearchOpen(false);
    setQuery('');
    setMatches([]);
    setMatchPos(0);
  }

  // Titled plain-text block: "Program — Outlet / Aired … · length" then the body.
  function buildExportText() {
    const header = article.program ? `${article.program} — ${article.outlet}` : article.outlet;
    const meta = [article.aired ? `Aired ${article.aired}` : null, article.length].filter(Boolean).join(' · ');
    const body = (article.transcript ?? '').trim();
    return `${header}${meta ? `\n${meta}` : ''}\n\n${body}`.trim();
  }

  function flagCopied() {
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  async function copyTranscript() {
    await Clipboard.setStringAsync(buildExportText());
    flagCopied();
  }

  // "Download" on mobile = write a .txt to cache and open the native share sheet
  // (Save to Files / Drive / send). Falls back to clipboard where sharing is n/a.
  async function downloadTranscript() {
    try {
      const text = buildExportText();
      if (!(await Sharing.isAvailableAsync())) {
        await Clipboard.setStringAsync(text);
        flagCopied();
        return;
      }
      const base = (article.program ?? article.outlet ?? 'transcript')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const file = new File(Paths.cache, `${base || 'transcript'}-transcript.txt`);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        UTI: 'public.plain-text',
        dialogTitle: 'Export transcript',
      });
    } catch {
      Alert.alert('Export failed', 'Could not export the transcript. Please try again.');
    }
  }

  // Percentage-based so the worklets read only shared values — capturing a
  // measured width/height would make Reanimated re-run them on JS during render.
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({ left: `${progress.get() * 100}%` }));
  const wavePlayedStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  const playIcon = playing ? 'pause' : 'play';
  const curWord = Math.min(wordIndex, Math.max(0, (sentences[activeIndex]?.words.length ?? 1) - 1));

  // Playback transport — rendered ON the media (video overlay + radio card), so
  // there are no controls outside the player (YouTube-style). White-themed for
  // the dark backdrops; reused by both so the two players stay in sync.
  function renderControls() {
    return (
      <>
        <View style={styles.ovScrubRow}>
          <Text style={styles.ovTime}>{fmt(posSec)}</Text>
          <View
            style={styles.ovScrub}
            onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => scrubAt(e.nativeEvent.locationX)}
            onResponderMove={(e) => scrubAt(e.nativeEvent.locationX)}
            onResponderRelease={scrubRelease}
            accessibilityRole="adjustable"
            accessibilityLabel="Seek">
            <View style={styles.ovScrubTrack}>
              <Animated.View style={[styles.ovScrubFill, { backgroundColor: accentColor }, fillStyle]} />
            </View>
            <Animated.View style={[styles.ovScrubKnob, { backgroundColor: accentColor }, knobStyle]} />
          </View>
          <Text style={styles.ovTime}>{fmt(total)}</Text>
        </View>
        <View style={styles.ovControls}>
          <View style={styles.ovTransport}>
            <Pressable
              onPress={() => seek(posSec - 10)}
              accessibilityRole="button"
              accessibilityLabel="Back 10 seconds"
              hitSlop={6}
              style={({ pressed }) => [styles.ovSkip, pressed && styles.pressed]}>
              <Ionicons name="play-back" size={20} color="#FFFFFF" />
              <Text style={styles.ovSkipText}>10s</Text>
            </Pressable>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Play'}
              style={({ pressed }) => [styles.ovPlay, pressed && styles.pressed]}>
              {/* Dark icon on the always-white play button — stays dark in both schemes. */}
              <Ionicons name={playIcon} size={22} color="#1A1A1A" style={playing ? undefined : { marginLeft: 2 }} />
            </Pressable>
            <Pressable
              onPress={() => seek(posSec + 10)}
              accessibilityRole="button"
              accessibilityLabel="Forward 10 seconds"
              hitSlop={6}
              style={({ pressed }) => [styles.ovSkip, pressed && styles.pressed]}>
              <Ionicons name="play-forward" size={20} color="#FFFFFF" />
              <Text style={styles.ovSkipText}>10s</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={cycleSpeed}
            accessibilityRole="button"
            accessibilityLabel={`Speed ${speed}x`}
            style={({ pressed }) => [styles.ovSpeed, pressed && styles.pressed]}>
            <Text style={styles.ovSpeedText}>{speed.toFixed(2).replace(/0$/, '')}×</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <RNAnimated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    Transcript
                  </Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {[article.program ?? article.outlet, article.length].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void copyTranscript()}
                  accessibilityRole="button"
                  accessibilityLabel={copied ? 'Transcript copied' : 'Copy transcript'}
                  hitSlop={8}
                  style={({ pressed }) => [styles.headerBtn, copied && { backgroundColor: `${accentColor}1A` }, pressed && styles.pressed]}>
                  <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={20} color={copied ? accentColor : theme.text} />
                </Pressable>
                <Pressable
                  onPress={() => void downloadTranscript()}
                  accessibilityRole="button"
                  accessibilityLabel="Download transcript"
                  hitSlop={8}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                  <Ionicons name="download-outline" size={20} color={theme.text} />
                </Pressable>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close transcript"
                  hitSlop={8}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          {/* Pinned player */}
          <View style={styles.heroClip}>
            <View>
              {isVideo ? (
                <View style={styles.videoWrap}>
                  {article.thumbnail && <Image source={article.thumbnail} style={styles.video} resizeMode="cover" />}
                  {/* Full-video tap target toggles play/pause; the explicit
                      play/pause lives in the overlay control bar below. */}
                  <Pressable
                    onPress={toggle}
                    accessibilityRole="button"
                    accessibilityLabel={playing ? 'Pause' : 'Play'}
                    style={styles.videoOverlay}
                  />
                  <Text style={styles.videoCap}>{article.outlet.toUpperCase()}</Text>
                  {/* Controls overlaid on the video (over a bottom scrim) — no
                      playback controls live outside the player. */}
                  <View style={styles.videoControls} pointerEvents="box-none">
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    {renderControls()}
                  </View>
                </View>
              ) : (
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.radio}>
                  <View style={styles.radioTop}>
                    <View style={styles.station}>
                      <Text style={styles.stationText} numberOfLines={1}>
                        {article.outlet}
                      </Text>
                    </View>
                    <Text style={styles.program} numberOfLines={1}>
                      {article.program}
                    </Text>
                  </View>
                  <View style={styles.wave} onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}>
                    <View style={styles.waveRow}>
                      {bars.map((h, i) => (
                        <View key={i} style={[styles.waveBar, { height: `${40 + h * 60}%`, backgroundColor: 'rgba(255,255,255,0.28)' }]} />
                      ))}
                    </View>
                    <Animated.View style={[styles.wavePlayed, wavePlayedStyle]}>
                      <View style={[styles.waveRow, { width: waveW }]}>
                        {bars.map((h, i) => (
                          <View key={i} style={[styles.waveBar, { height: `${40 + h * 60}%`, backgroundColor: '#FFFFFF' }]} />
                        ))}
                      </View>
                    </Animated.View>
                  </View>
                  {/* Controls on the radio card — no playback controls outside the player. */}
                  {renderControls()}
                </LinearGradient>
              )}
            </View>
          </View>

          {/* Transcript */}
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={[styles.transcriptBody, { paddingBottom: insets.bottom + 96 }]}
            showsVerticalScrollIndicator={false}
            onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
            onScrollBeginDrag={() => setAuto(false)}>
            {sentences.map((s, i) => (
              <TranscriptLine
                key={i}
                index={i}
                words={s.words}
                text={s.text}
                state={i === activeIndex ? 'active' : i < activeIndex ? 'played' : 'upcoming'}
                curWord={i === activeIndex ? curWord : -1}
                accent={accentColor}
                isMatch={matches.includes(i)}
                onSeek={handleSeek}
                onMeasure={handleMeasure}
              />
            ))}
          </ScrollView>

          {!auto && !searchOpen && (
            <Pressable onPress={resumeAuto} accessibilityRole="button" style={({ pressed }) => [styles.jump, pressed && styles.pressed]}>
              <Text style={styles.jumpText}>Jump to current</Text>
              <Ionicons name="arrow-down" size={13} color={theme.card} />
            </Pressable>
          )}

          {/* Floating search: a bottom-right FAB that expands into a search bar
              pinned to the bottom (lifted above the keyboard while typing). */}
          {searchOpen ? (
            <View
              style={[
                styles.searchDock,
                { bottom: keyboardHeight > 0 ? keyboardHeight + Spacing.four : insets.bottom + Spacing.three },
              ]}>
              <Ionicons name="search" size={18} color={theme.textSecondary} />
              <TextInput
                value={query}
                onChangeText={runSearch}
                placeholder="Search transcript…"
                placeholderTextColor={theme.textSecondary}
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
              />
              <Text style={styles.searchCount}>
                {matches.length ? `${matchPos + 1}/${matches.length}` : query ? '0' : ''}
              </Text>
              <Pressable onPress={() => gotoMatch(-1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Previous match" style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name="chevron-up" size={18} color={theme.textSecondary} />
              </Pressable>
              <Pressable onPress={() => gotoMatch(1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Next match" style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
              </Pressable>
              <Pressable onPress={closeSearch} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close search" style={({ pressed }) => [styles.searchClose, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setSearchOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Search transcript"
              style={({ pressed }) => [
                styles.searchFab,
                { bottom: insets.bottom + Spacing.four, backgroundColor: accentColor },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="search" size={24} color="#FFFFFF" />
            </Pressable>
          )}
        </RNAnimated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Transcript reading-state greys don't map 1:1 to a theme token, so pick
// scheme-appropriate values (inverted lightness on dark): already-read /
// word-ahead text fades out, upcoming text stays a touch more prominent.
const makeStyles = (t: Theme) => {
  const isDark = t.isDark;
  const faded = isDark ? '#6B6F77' : '#A8A29A'; // played / ahead
  const upcoming = isDark ? '#C7CAD1' : '#4C4945'; // not yet read
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: t.surfaceWarm },
  fill: { flex: 1 },
  pressed: { opacity: 0.6 },

  headerWrap: { borderBottomWidth: 1, borderBottomColor: t.border },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.border, marginTop: Spacing.two, marginBottom: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: t.text },
  headerSub: { fontSize: 12, color: t.textSecondary, marginTop: 1 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  heroClip: { overflow: 'hidden', marginHorizontal: Spacing.three, marginTop: Spacing.three },

  radio: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three, overflow: 'hidden' },
  radioTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  station: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7, maxWidth: '40%' },
  stationText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  program: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  wave: { height: 70, justifyContent: 'center' },
  waveRow: { flexDirection: 'row', alignItems: 'center', height: '100%', gap: 2 },
  waveBar: { flex: 1, minWidth: 2, borderRadius: 2 },
  wavePlayed: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },

  videoWrap: { borderRadius: Spacing.three, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#1b2340' },
  video: { width: '100%', height: '100%' },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.08)' },
  // Caption moved to the TOP so it clears the new bottom control overlay.
  videoCap: { position: 'absolute', left: Spacing.two, top: Spacing.two, color: '#FFFFFF', fontWeight: '800', fontSize: 11, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  // ── On-media control overlay (video overlay + radio card), white-themed ──
  videoControls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.two + 2, paddingTop: Spacing.five, paddingBottom: Spacing.two, gap: Spacing.one },
  ovScrubRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ovTime: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', fontVariant: ['tabular-nums'], width: 34, textAlign: 'center' },
  ovScrub: { flex: 1, height: 24, justifyContent: 'center' },
  ovScrubTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  ovScrubFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  ovScrubKnob: { position: 'absolute', top: '50%', left: 0, width: 14, height: 14, borderRadius: 7, marginTop: -7, marginLeft: -7 },
  ovControls: { position: 'relative', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.one },
  ovTransport: { flexDirection: 'row', alignItems: 'center', gap: Spacing.five },
  ovSkip: { alignItems: 'center', gap: 1 },
  ovSkipText: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  ovPlay: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  ovSpeed: { position: 'absolute', right: 0, top: '50%', transform: [{ translateY: -15 }], minWidth: 44, height: 30, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  ovSpeedText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // Floating search affordance (bottom-right FAB ⇄ bottom search dock).
  searchFab: { position: 'absolute', right: Spacing.three, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  searchDock: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 999, paddingLeft: Spacing.three, paddingRight: Spacing.two, paddingVertical: Spacing.two, shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  searchClose: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.track },
  searchInput: { flex: 1, fontSize: 15, color: t.text, padding: 0 },
  searchCount: { fontSize: 12, color: t.textSecondary, fontVariant: ['tabular-nums'] },

  transcript: { flex: 1 },
  transcriptBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  sentence: { marginBottom: 2, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two + 2, borderRadius: 10 },
  // Amber search-match tint — a translucent highlight that reads on both schemes.
  sentenceMatch: { backgroundColor: 'rgba(240,180,41,0.16)' },
  sentenceText: { fontSize: 16, lineHeight: 25, color: t.text },
  played: { color: faded },
  upcoming: { color: upcoming },
  wSpoken: { color: t.text },
  wCurrent: { fontWeight: '700', borderRadius: 4 },
  // Ahead words in the ACTIVE sentence stay clearly readable (a touch dimmer
  // than spoken) instead of fading into the inactive-text grey, so the
  // highlighted line reads as one legible sentence with a subtle sweep.
  wAhead: { color: t.textSecondary },

  // Inverted "jump to current" pill — ink surface + card-colored label, so it
  // stays high-contrast (dark-on-light flips to light-on-dark) in both schemes.
  jump: { position: 'absolute', bottom: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  jumpText: { color: t.card, fontSize: 12, fontWeight: '700' },
  });
};
