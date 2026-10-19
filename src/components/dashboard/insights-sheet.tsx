// Insights panel (spec §2–§9 "Insights") — the mobile stand-in for the web's
// right slide-over. Full-screen slide-up with pull-to-dismiss (same shell as
// ExploreSheet), restyled to match the web's ti-* hierarchy: a badge+title+sub
// header with a labelled Export, an AI narrative, a 2×2 stat grid, and sections
// (key trends, spike/drop callouts, ranked rows). Ranked rows mirror the web's
// .ti-rank — a numbered pill with a subtle proportional fill behind — and, like
// the reference, drill through to the posts behind them via onDrill.
import { Ionicons } from '@expo/vector-icons';
import { Animated, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { InsightDrill, InsightIcon, InsightReport, InsightSection } from '@/components/dashboard/insights';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing, Theme } from '@/constants/theme';
import { useSemanticColors, useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DEFAULT_BAR = '#7c3aed';

// Tone → color, resolved from the active scheme's semantic accents (so up/down
// lighten on dark) with the neutral tone falling back to secondary text.
function useToneColor() {
  const sem = useSemanticColors();
  const theme = useTheme();
  return { up: sem.positive, down: sem.negative, neutral: theme.textSecondary } as const;
}

// Web parity (app.css .ti-sec-title): the section icon is tinted by type.
// Greens/coral come from the scheme's semantic accents (brighter on dark); the
// amber reads on both canvases; the brand purple is lightened on dark.
function sectionIconColor(
  icon: InsightIcon,
  sem: { positive: string; negative: string },
  isDark: boolean,
): string {
  if (icon === 'trending-up') return sem.positive;
  if (icon === 'trending-down') return sem.negative;
  if (icon === 'flash' || icon === 'bulb') return '#f59e0b';
  return isDark ? '#A78BFA' : '#7c3aed';
}

export function InsightsSheet({
  report,
  onClose,
  onDrill,
}: {
  report: InsightReport | null;
  onClose: () => void;
  onDrill: (drill: InsightDrill) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const toneColor = useToneColor();
  const dismiss = useDismissGesture(onClose);

  function exportReport() {
    if (report) Share.share({ message: reportToText(report) }).catch(() => {});
  }

  return (
    <Modal visible={report !== null} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader
                onClose={onClose}
                rightActions={
                  <Pressable
                    onPress={exportReport}
                    accessibilityRole="button"
                    accessibilityLabel="Export insights"
                    hitSlop={8}
                    style={({ pressed }) => [styles.exportPill, pressed && styles.pressed]}>
                    <Ionicons name="share-outline" size={14} color={theme.card} />
                    <Text style={styles.exportPillText}>Export</Text>
                  </Pressable>
                }>
                <View style={styles.headRow}>
                  <View style={styles.headBadge}>
                    <Ionicons name="sparkles" size={15} color={isDark ? '#A78BFA' : '#7c3aed'} />
                  </View>
                  <View style={styles.headTitles}>
                    <Text style={styles.headTitle}>Insights</Text>
                    <Text style={styles.headSub} numberOfLines={1}>
                      {report?.sub ?? ''}
                    </Text>
                  </View>
                </View>
              </SheetHeader>
            </View>
          </GestureDetector>

          {report ? (
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              onScroll={dismiss.onScroll}
              scrollEventThrottle={16}>
              <View style={styles.narrative}>
                <RichText text={report.narrative} style={styles.narrativeText} />
              </View>

              <View style={styles.statGrid}>
                {report.stats.map((s) => (
                  <View key={s.label} style={styles.statTile}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {s.label.toUpperCase()}
                    </Text>
                    <Text
                      style={[styles.statValue, s.tone ? { color: toneColor[s.tone] } : null]}
                      numberOfLines={1}>
                      {s.value}
                    </Text>
                    <Text style={styles.statSub} numberOfLines={1}>
                      {s.sub}
                    </Text>
                  </View>
                ))}
              </View>

              {report.sections.map((section, i) => (
                <Section key={`${section.title}-${i}`} section={section} onDrill={onDrill} />
              ))}

              <View style={styles.footer}>
                <Ionicons name="sparkles" size={12} color={theme.textTertiary} />
                <Text style={styles.footerText}>{report.footer}</Text>
              </View>
            </ScrollView>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Section({ section, onDrill }: { section: InsightSection; onDrill: (d: InsightDrill) => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const sem = useSemanticColors();
  const { isDark } = useThemeMode();
  const toneColor = useToneColor();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={section.icon} size={14} color={sectionIconColor(section.icon, sem, isDark)} />
        <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
      </View>

      {section.kind === 'insights'
        ? section.items.map((item, i) => (
            <View key={i} style={styles.insightRow}>
              <Ionicons
                name={section.icons?.[i] ?? section.icon}
                size={14}
                color={theme.textTertiary}
                style={styles.insightIcon}
              />
              <RichText text={item} style={styles.insightText} />
            </View>
          ))
        : null}

      {section.kind === 'callouts'
        ? section.callouts.map((c, i) => {
            const color = toneColor[c.tone];
            const drill = c.drill;
            const body = (
              <>
                <View style={[styles.calloutIcon, { backgroundColor: `${color}1A` }]}>
                  <Ionicons name={c.icon} size={16} color={color} />
                </View>
                <View style={styles.calloutText}>
                  <Text style={styles.calloutLabel} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <Text style={styles.calloutSub} numberOfLines={1}>
                    {c.sub}
                  </Text>
                </View>
                <Text style={[styles.calloutValue, { color }]}>{c.value}</Text>
              </>
            );
            return drill ? (
              <Pressable
                key={i}
                onPress={() => onDrill(drill)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.callout, pressed && styles.pressed]}>
                {body}
              </Pressable>
            ) : (
              <View key={i} style={styles.callout}>
                {body}
              </View>
            );
          })
        : null}

      {section.kind === 'rank'
        ? section.rows.map((r, i) => {
            const fillColor = r.color ?? section.barColor ?? DEFAULT_BAR;
            const drill = r.drill;
            const body = (
              <>
                <View
                  style={[styles.rankFill, { width: `${Math.max(0, Math.min(100, r.pct))}%`, backgroundColor: fillColor }]}
                />
                <Text style={styles.rankNo}>{i + 1}</Text>
                <Text style={styles.rankName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.rankValue}>{r.value}</Text>
              </>
            );
            return drill ? (
              <Pressable
                key={i}
                onPress={() => onDrill(drill)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.rankRow, pressed && styles.pressed]}>
                {body}
              </Pressable>
            ) : (
              <View key={i} style={styles.rankRow}>
                {body}
              </View>
            );
          })
        : null}
    </View>
  );
}

// Renders a string with **bold** segments.
function RichText({ text, style }: { text: string; style?: object }) {
  const styles = useThemedStyles(makeStyles);
  const parts = text.split('**');
  return (
    <Text style={style}>
      {parts.map((p, i) => (i % 2 === 1 ? <Text key={i} style={styles.bold}>{p}</Text> : p))}
    </Text>
  );
}

function reportToText(r: InsightReport): string {
  const strip = (s: string) => s.replace(/\*\*/g, '');
  const lines = [r.title, '', strip(r.narrative), ''];
  r.stats.forEach((s) => lines.push(`${s.label}: ${s.value} — ${s.sub}`));
  r.sections.forEach((sec) => {
    lines.push('', sec.title);
    if (sec.kind === 'insights') sec.items.forEach((i) => lines.push(`• ${strip(i)}`));
    else if (sec.kind === 'callouts') sec.callouts.forEach((c) => lines.push(`• ${c.label} — ${c.sub}: ${c.value}`));
    else sec.rows.forEach((row, i) => lines.push(`${i + 1}. ${row.name}: ${row.value}`));
  });
  lines.push('', r.footer);
  return lines.join('\n');
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  fill: {
    flex: 1,
  },

  // Header (web .ti-head)
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.12)', // faint brand-purple tint, reads on both canvases
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitles: {
    flex: 1,
    minWidth: 0,
  },
  headTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: t.text,
  },
  headSub: {
    fontSize: 12,
    color: t.textSecondary,
    marginTop: 1,
  },
  // Inverted primary pill: ink fill + card-colored content (flips to a light
  // pill with dark content on the dark canvas).
  exportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: t.text,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.card,
  },

  body: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },

  // Narrative (web .ti-narrative)
  narrative: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 14,
    padding: Spacing.three,
  },
  narrativeText: {
    fontSize: 14,
    lineHeight: 21,
    color: t.textSecondary,
  },
  bold: {
    fontWeight: '800',
    color: t.text,
  },

  // Stat tiles (web .ti-stat)
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: 3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: t.textTertiary,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: t.text,
    letterSpacing: -0.4,
  },
  statSub: {
    fontSize: 11,
    color: t.textSecondary,
  },

  // Section (web .ti-sec-title has a top-border divider)
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.borderCool,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: t.text,
    letterSpacing: 0.4,
  },

  // Key-trend rows (web .ti-insight)
  insightRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    paddingRight: Spacing.one,
  },
  insightIcon: {
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: t.textSecondary,
  },

  // Callouts (web .ti-callout)
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    borderRadius: 12,
    padding: Spacing.two + 2,
  },
  calloutIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutText: {
    flex: 1,
  },
  calloutLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: t.text,
  },
  calloutSub: {
    fontSize: 12,
    color: t.textSecondary,
    marginTop: 1,
  },
  calloutValue: {
    fontSize: 16,
    fontWeight: '800',
  },

  // Ranked rows (web .ti-rank — numbered pill + subtle proportional fill)
  rankRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: t.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.cardBorder,
    marginBottom: 4,
  },
  rankFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.18,
  },
  rankNo: {
    fontSize: 11,
    fontWeight: '700',
    color: t.textTertiary,
    minWidth: 12,
  },
  rankName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: t.text,
  },
  rankValue: {
    fontSize: 13,
    fontWeight: '800',
    color: t.text,
  },

  // Footer (web .ti-foot)
  footer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.borderCool,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: t.textTertiary,
  },
  pressed: {
    opacity: 0.6,
  },
});
