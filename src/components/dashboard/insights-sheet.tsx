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

import { chartTokens } from '@/components/dashboard/palette';
import { InsightDrill, InsightIcon, InsightReport, InsightSection } from '@/components/dashboard/insights';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';

const TONE_COLOR = { up: '#16A34A', down: '#E94F37', neutral: chartTokens.textSecondary };
const DEFAULT_BAR = '#7c3aed';

// Web parity (app.css .ti-sec-title): the section icon is tinted by type.
function sectionIconColor(icon: InsightIcon): string {
  if (icon === 'trending-up') return '#16a34a';
  if (icon === 'trending-down') return '#e94f37';
  if (icon === 'flash' || icon === 'bulb') return '#f59e0b';
  return '#7c3aed';
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
                    <Ionicons name="share-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.exportPillText}>Export</Text>
                  </Pressable>
                }>
                <View style={styles.headRow}>
                  <View style={styles.headBadge}>
                    <Ionicons name="sparkles" size={15} color="#7c3aed" />
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
                      style={[styles.statValue, s.tone ? { color: TONE_COLOR[s.tone] } : null]}
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
                <Ionicons name="sparkles" size={12} color={chartTokens.axisText} />
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={section.icon} size={14} color={sectionIconColor(section.icon)} />
        <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
      </View>

      {section.kind === 'insights'
        ? section.items.map((item, i) => (
            <View key={i} style={styles.insightRow}>
              <Ionicons
                name={section.icons?.[i] ?? section.icon}
                size={14}
                color={chartTokens.axisText}
                style={styles.insightIcon}
              />
              <RichText text={item} style={styles.insightText} />
            </View>
          ))
        : null}

      {section.kind === 'callouts'
        ? section.callouts.map((c, i) => {
            const color = TONE_COLOR[c.tone];
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F4F0',
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
    backgroundColor: 'rgba(124,58,237,0.12)',
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
    color: chartTokens.text,
  },
  headSub: {
    fontSize: 12,
    color: chartTokens.textSecondary,
    marginTop: 1,
  },
  exportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1A1A1A',
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  body: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },

  // Narrative (web .ti-narrative)
  narrative: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 14,
    padding: Spacing.three,
  },
  narrativeText: {
    fontSize: 14,
    lineHeight: 21,
    color: chartTokens.textSecondary,
  },
  bold: {
    fontWeight: '800',
    color: chartTokens.text,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: chartTokens.border,
    borderRadius: 12,
    padding: Spacing.two + 2,
    gap: 3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: chartTokens.axisText,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: chartTokens.text,
    letterSpacing: -0.4,
  },
  statSub: {
    fontSize: 11,
    color: chartTokens.textSecondary,
  },

  // Section (web .ti-sec-title has a top-border divider)
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: chartTokens.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: chartTokens.text,
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
    color: chartTokens.textSecondary,
  },

  // Callouts (web .ti-callout)
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: chartTokens.border,
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
    color: chartTokens.text,
  },
  calloutSub: {
    fontSize: 12,
    color: chartTokens.textSecondary,
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
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: chartTokens.border,
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
    color: chartTokens.axisText,
    minWidth: 12,
  },
  rankName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: chartTokens.text,
  },
  rankValue: {
    fontSize: 13,
    fontWeight: '800',
    color: chartTokens.text,
  },

  // Footer (web .ti-foot)
  footer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: chartTokens.border,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: chartTokens.axisText,
  },
  pressed: {
    opacity: 0.6,
  },
});
