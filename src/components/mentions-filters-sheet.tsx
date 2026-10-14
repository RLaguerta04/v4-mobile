import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaMeterColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { cloneFilters, SavedFilter, useSavedFilters } from '@/contexts/saved-filters-context';
import { socialMentions } from '@/data/sample-data';
import { CATEGORY_TAXONOMY } from '@/data/taxonomy';
import { SocialMention, SocialPlatform } from '@/data/types';

export type SortOrder = 'newest' | 'oldest';

export interface MentionsFilters {
  sortOrder: SortOrder;
  platforms: Set<SocialPlatform>;
  // Shared with the inline Topics pill row on the Mentions screen — both
  // read/write this same set, so there's one topic filter, not two.
  topics: Set<string>;
  dateRange: { start: Date | null; end: Date | null };
  // Only "Philippines" exists in this dataset — there's no country field to
  // actually filter against, so this toggle is intentionally decorative,
  // mirroring the real app's Country sheet without fabricating data.
  countryEnabled: boolean;
}

export const ALL_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'twitter',
  'instagram',
  'youtube',
  'reddit',
  'tiktok',
];

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  reddit: 'Reddit',
  tiktok: 'TikTok',
};

// Categories & Buckets & Keywords — a structured, expandable view of the
// same BYD taxonomy the Home header's Category dropdown reads from. Bucket
// selection here writes to the same `topics` set the header's category
// filter and the (now-removed) inline pill row used, so there's one
// underlying topic filter regardless of which UI touches it.

export const DEFAULT_FILTERS: MentionsFilters = {
  sortOrder: 'newest',
  platforms: new Set(ALL_PLATFORMS),
  topics: new Set(),
  dateRange: { start: null, end: null },
  countryEnabled: true,
};

// Apply a MentionsFilters to a mention list — platform + topic/bucket + date
// range, then sort by date. Shared so any screen (Home, Dashboard) filters the
// same way. (Home layers its Category dropdown and author row on top of this.)
export function filterMentions(
  mentions: SocialMention[],
  filters: MentionsFilters,
): SocialMention[] {
  const { start, end } = filters.dateRange;
  const out = mentions.filter((m) => {
    if (filters.topics.size > 0 && !m.entities.some((e) => filters.topics.has(e))) return false;
    if (!filters.platforms.has(m.platform)) return false;
    if (start || end) {
      const d = new Date(m.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
    }
    return true;
  });
  return out.sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return filters.sortOrder === 'newest' ? diff : -diff;
  });
}

const palette = {
  sheetBg: '#FFFFFF',
  pillBg: '#F0F0F0',
  pillText: '#1A1A1A',
  pillSelectedBg: '#1A1A1A',
  pillSelectedText: '#FFFFFF',
  sectionLabel: '#6B7280',
  border: '#E4E6EA',
  rangeHighlight: MediaMeterColors.pastelLilac,
};

const QUICK_RANGES: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 182 },
  { label: '1Y', days: 365 },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// The default Home date window — the last 7 days up to today.
export function last7Days(): { start: Date; end: Date } {
  const end = startOfDay(new Date());
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - 7);
  return { start, end };
}

function formatDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

function latestMentionDate(): Date {
  const dates = socialMentions.map((m) => new Date(m.date)).filter((d) => !Number.isNaN(d.getTime()));
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { accentColor } = useAuth();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.pill, active && { backgroundColor: accentColor }]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function KeywordGroup({ label, words, excluded }: { label: string; words: string[]; excluded?: boolean }) {
  return (
    <View style={styles.keywordGroup}>
      <Text style={styles.keywordGroupLabel}>{label}</Text>
      <View style={styles.keywordChipRow}>
        {words.map((word) => (
          <View key={word} style={[styles.keywordChip, excluded && styles.keywordChipExcluded]}>
            <Text style={[styles.keywordChipText, excluded && styles.keywordChipTextExcluded]}>{word}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CalendarGrid({
  viewYear,
  viewMonth,
  start,
  end,
  onSelectDay,
}: {
  viewYear: number;
  viewMonth: number;
  start: Date | null;
  end: Date | null;
  onSelectDay: (day: Date) => void;
}) {
  const { accentColor } = useAuth();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={styles.calendarWeekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.calendarWeekday}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.calendarWeekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.calendarCell} />;
            const isStart = start && sameDay(day, start);
            const isEnd = end && sameDay(day, end);
            const inRange = start && end && day > start && day < end;
            return (
              <Pressable
                key={i}
                onPress={() => onSelectDay(day)}
                style={[
                  styles.calendarCell,
                  Boolean(inRange) && styles.calendarCellInRange,
                  Boolean(isStart || isEnd) && { backgroundColor: accentColor },
                ]}>
                <Text
                  style={[
                    styles.calendarCellText,
                    Boolean(isStart || isEnd) && styles.calendarCellTextSelected,
                  ]}>
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function MentionsFiltersSheet({
  visible,
  initialFilters,
  onApply,
  onClose,
  hideMediaSource = false,
}: {
  visible: boolean;
  initialFilters: MentionsFilters;
  onApply: (filters: MentionsFilters) => void;
  onClose: () => void;
  // Hide the Media Source (platforms) section — e.g. the Dashboard keeps its
  // own platform pill row, so platforms are controlled there instead.
  hideMediaSource?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { accentColor } = useAuth();
  const { saved, saveFilter, removeFilter } = useSavedFilters();
  const [pending, setPending] = useState<MentionsFilters>(initialFilters);
  const [viewDate, setViewDate] = useState(() => initialFilters.dateRange.start ?? latestMentionDate());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set());
  const [nameInput, setNameInput] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPending(initialFilters);
      setViewDate(initialFilters.dateRange.start ?? latestMentionDate());
      setCalendarOpen(false);
      setExpandedCategories(new Set());
      setExpandedKeywords(new Set());
      setNameInput(null);
    }
  }, [visible, initialFilters]);

  function togglePlatform(platform: SocialPlatform) {
    setPending((prev) => {
      const next = new Set(prev.platforms);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return { ...prev, platforms: next };
    });
  }

  function selectAllPlatforms() {
    setPending((prev) => ({ ...prev, platforms: new Set(ALL_PLATFORMS) }));
  }

  // Single-select: at most one bucket (and therefore one category) is active
  // at a time. Kept as a Set so the MentionsFilters shape and the feed's
  // filtering logic stay unchanged — the Set just never holds more than one.
  function toggleTopic(topic: string) {
    setPending((prev) => ({
      ...prev,
      topics: prev.topics.has(topic) ? new Set<string>() : new Set([topic]),
    }));
  }

  // Accordion: expanding a category collapses the others, mirroring the
  // one-category-at-a-time selection model.
  function toggleCategoryExpanded(category: string) {
    setExpandedCategories((prev) => (prev.has(category) ? new Set<string>() : new Set([category])));
  }

  function toggleBucketKeywords(bucket: string) {
    setExpandedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  function applyQuickRange(days: number) {
    const end = startOfDay(new Date());
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - days);
    setPending((prev) => ({ ...prev, dateRange: { start, end } }));
    setViewDate(start);
    setCalendarOpen(false);
  }

  function onSelectDay(day: Date) {
    setPending((prev) => {
      const { start, end } = prev.dateRange;
      if (!start || (start && end)) {
        return { ...prev, dateRange: { start: day, end: null } };
      }
      if (day < start) {
        return { ...prev, dateRange: { start: day, end: start } };
      }
      return { ...prev, dateRange: { start, end: day } };
    });
  }

  function changeMonth(delta: number) {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function handleReset() {
    setPending(DEFAULT_FILTERS);
    setViewDate(latestMentionDate());
    setCalendarOpen(false);
    setExpandedCategories(new Set());
    setExpandedKeywords(new Set());
    setNameInput(null);
  }

  function loadSaved(sf: SavedFilter) {
    const f = cloneFilters(sf.filters);
    setPending(f);
    setViewDate(f.dateRange.start ?? latestMentionDate());
    setCalendarOpen(false);
    setExpandedCategories(new Set());
    setExpandedKeywords(new Set());
    setNameInput(null);
  }

  // A sensible default name from the current config — e.g. "Twitter / X · Product".
  function suggestName(f: MentionsFilters): string {
    const parts: string[] = [];
    if (f.platforms.size === 1) parts.push(PLATFORM_LABEL[[...f.platforms][0]]);
    else if (f.platforms.size < ALL_PLATFORMS.length) parts.push(`${f.platforms.size} sources`);
    if (f.topics.size > 0) parts.push([...f.topics][0]);
    if (f.dateRange.start) parts.push('Custom range');
    if (f.sortOrder === 'oldest') parts.push('Oldest first');
    return parts.length ? parts.join(' · ') : 'My filter';
  }

  function saveCurrent() {
    const name = (nameInput ?? '').trim() || suggestName(pending);
    saveFilter(name, pending);
    setNameInput(null);
  }

  const allPlatformsSelected = pending.platforms.size === ALL_PLATFORMS.length;
  const { start: rangeStart, end: rangeEnd } = pending.dateRange;
  const rangeSummary =
    rangeStart && rangeEnd
      ? `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`
      : rangeStart
        ? `${formatDate(rangeStart)} – select end date`
        : null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.sheet,
          {
            paddingTop: Math.max(insets.top, Spacing.three),
            paddingBottom: Math.max(insets.bottom, Spacing.three),
          },
        ]}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            style={styles.closeButton}>
            <Ionicons name="close" size={18} color={palette.pillText} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}>
          <SectionLabel>Saved filters</SectionLabel>
          <View style={styles.pillRow}>
            {saved.map((sf) => (
              <View key={sf.id} style={styles.savedChip}>
                <Pressable
                  onPress={() => loadSaved(sf)}
                  accessibilityRole="button"
                  accessibilityLabel={`Load filter ${sf.name}`}
                  style={styles.savedChipMain}>
                  <Ionicons name="star" size={12} color={accentColor} />
                  <Text style={styles.savedChipText} numberOfLines={1}>
                    {sf.name}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => removeFilter(sf.id)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete filter ${sf.name}`}
                  style={styles.savedChipClose}>
                  <Ionicons name="close" size={13} color={palette.sectionLabel} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => setNameInput(suggestName(pending))}
              accessibilityRole="button"
              accessibilityLabel="Save current filter"
              style={styles.saveChip}>
              <Ionicons name="add" size={15} color={palette.pillText} />
              <Text style={styles.saveChipText}>Save current</Text>
            </Pressable>
          </View>
          {nameInput !== null && (
            <View style={styles.saveRow}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Name this filter"
                placeholderTextColor={palette.sectionLabel}
                style={styles.saveInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveCurrent}
              />
              <Pressable
                onPress={saveCurrent}
                accessibilityRole="button"
                style={[styles.saveConfirm, { backgroundColor: accentColor }]}>
                <Text style={styles.saveConfirmText}>Save</Text>
              </Pressable>
              <Pressable
                onPress={() => setNameInput(null)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.saveCancel}>
                <Ionicons name="close" size={16} color={palette.sectionLabel} />
              </Pressable>
            </View>
          )}

          <SectionLabel>Sort by</SectionLabel>
          <View style={styles.pillRow}>
            <Pill
              label="Newest Mention"
              active={pending.sortOrder === 'newest'}
              onPress={() => setPending((p) => ({ ...p, sortOrder: 'newest' }))}
            />
            <Pill
              label="Oldest Mention"
              active={pending.sortOrder === 'oldest'}
              onPress={() => setPending((p) => ({ ...p, sortOrder: 'oldest' }))}
            />
          </View>

          {!hideMediaSource && (
            <>
              <SectionLabel>Media Source</SectionLabel>
              <View style={styles.pillRow}>
                <Pill label="Select All" active={allPlatformsSelected} onPress={selectAllPlatforms} />
                {ALL_PLATFORMS.map((platform) => (
                  <Pill
                    key={platform}
                    label={PLATFORM_LABEL[platform]}
                    active={pending.platforms.has(platform)}
                    onPress={() => togglePlatform(platform)}
                  />
                ))}
              </View>
            </>
          )}

          <SectionLabel>Categories & Buckets</SectionLabel>
          <View style={styles.treeList}>
            {CATEGORY_TAXONOMY.map(({ name: category, buckets }) => {
              const expanded = expandedCategories.has(category);
              const selectedTopics = buckets.map((b) => b.name).filter((t) => pending.topics.has(t));
              return (
                <View key={category} style={styles.treeCategoryDivider}>
                  <Pressable
                    onPress={() => toggleCategoryExpanded(category)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={styles.treeCategoryRow}>
                    <View style={styles.treeCategoryLabelColumn}>
                      <Text style={[styles.treeCategoryText, selectedTopics.length > 0 && { color: accentColor }]}>
                        {category}
                      </Text>
                      {selectedTopics.length > 0 && (
                        <Text style={styles.treeCategorySubtitle} numberOfLines={1}>
                          {selectedTopics.join(', ')}
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={palette.sectionLabel}
                    />
                  </Pressable>
                  {expanded && (
                    <View style={styles.treeBucketList}>
                      {buckets.map((bucket) => {
                        const active = pending.topics.has(bucket.name);
                        const keywordsShown = expandedKeywords.has(bucket.name);
                        return (
                          <View key={bucket.name}>
                            <View style={styles.treeBucketRow}>
                              <Pressable
                                onPress={() => toggleBucketKeywords(bucket.name)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`${bucket.name} keywords`}
                                accessibilityState={{ expanded: keywordsShown }}>
                                <Ionicons
                                  name={keywordsShown ? 'chevron-up' : 'information-circle-outline'}
                                  size={16}
                                  color={palette.sectionLabel}
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => toggleTopic(bucket.name)}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: active }}
                                style={styles.treeBucketSelect}>
                                <Text
                                  style={[
                                    styles.treeBucketText,
                                    active && { color: accentColor, fontWeight: '700' },
                                  ]}>
                                  {bucket.name}
                                </Text>
                                <Ionicons
                                  name={active ? 'radio-button-on' : 'radio-button-off'}
                                  size={18}
                                  color={active ? accentColor : palette.sectionLabel}
                                />
                              </Pressable>
                            </View>
                            {keywordsShown && (
                              <View style={styles.keywordPanel}>
                                <KeywordGroup label="Main Keywords" words={bucket.keywords.main} />
                                {bucket.keywords.additional && (
                                  <KeywordGroup label="Additional Keywords" words={bucket.keywords.additional} />
                                )}
                                {bucket.keywords.related ? (
                                  <KeywordGroup label="Related Keywords" words={bucket.keywords.related} />
                                ) : (
                                  <Text style={styles.keywordEmptyText}>No related keywords added</Text>
                                )}
                                {bucket.keywords.excluded && (
                                  <KeywordGroup
                                    label="Excluded Keywords"
                                    words={bucket.keywords.excluded}
                                    excluded
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <SectionLabel>Date Range</SectionLabel>
          <View style={styles.pillRow}>
            {QUICK_RANGES.map((range) => (
              <Pill
                key={range.label}
                label={range.label}
                active={false}
                onPress={() => applyQuickRange(range.days)}
              />
            ))}
            <Pill label="Custom" active={calendarOpen} onPress={() => setCalendarOpen((v) => !v)} />
          </View>

          {!calendarOpen && rangeSummary && <Text style={styles.rangeSummary}>{rangeSummary}</Text>}

          {calendarOpen && (
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => changeMonth(-1)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color={palette.pillText} />
                </Pressable>
                <Text style={styles.calendarHeaderText}>
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </Text>
                <Pressable onPress={() => changeMonth(1)} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={18} color={palette.pillText} />
                </Pressable>
              </View>
              <CalendarGrid
                viewYear={viewDate.getFullYear()}
                viewMonth={viewDate.getMonth()}
                start={pending.dateRange.start}
                end={pending.dateRange.end}
                onSelectDay={onSelectDay}
              />
            </View>
          )}

          <SectionLabel>Country</SectionLabel>
          <View style={styles.pillRow}>
            <Pill
              label="Philippines"
              active={pending.countryEnabled}
              onPress={() => setPending((p) => ({ ...p, countryEnabled: !p.countryEnabled }))}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
          <Pressable style={[styles.applyButton, { backgroundColor: accentColor }]} onPress={() => onApply(pending)}>
            <Text style={styles.applyButtonText}>Apply filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.sheetBg,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.pillText,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.sectionLabel,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    backgroundColor: palette.pillBg,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.pillText,
  },
  pillTextActive: {
    color: palette.pillSelectedText,
  },
  rangeSummary: {
    marginTop: Spacing.two,
    fontSize: 13,
    fontWeight: '600',
    color: palette.pillText,
  },
  treeList: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  treeCategoryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  treeCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  treeCategoryLabelColumn: {
    flex: 1,
    gap: 2,
  },
  treeCategoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.pillText,
  },
  treeCategorySubtitle: {
    fontSize: 13,
    color: palette.sectionLabel,
  },
  treeBucketList: {
    paddingBottom: Spacing.two,
  },
  treeBucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingVertical: Spacing.two,
  },
  treeBucketSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  treeBucketText: {
    fontSize: 14,
    color: palette.pillText,
  },
  keywordPanel: {
    marginLeft: Spacing.three + 16 + Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  keywordGroup: {
    gap: 4,
  },
  keywordGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.sectionLabel,
    textTransform: 'uppercase',
  },
  keywordChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.pillBg,
  },
  keywordChipExcluded: {
    backgroundColor: '#FBE9E7',
  },
  keywordChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.pillText,
  },
  keywordChipTextExcluded: {
    color: '#B0463C',
    textDecorationLine: 'line-through',
  },
  keywordEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: palette.sectionLabel,
  },
  calendarCard: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: palette.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  calendarHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.pillText,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: palette.sectionLabel,
    paddingVertical: Spacing.one,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  calendarCellInRange: {
    backgroundColor: palette.rangeHighlight,
    borderRadius: 0,
  },
  calendarCellText: {
    fontSize: 13,
    color: palette.pillText,
  },
  calendarCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  resetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    backgroundColor: palette.pillBg,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.pillText,
  },
  applyButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: 999,
    backgroundColor: palette.pillSelectedBg,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: palette.pillBg,
    paddingLeft: Spacing.two + 2,
    paddingRight: 2,
  },
  savedChipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.one + 2,
    maxWidth: 180,
  },
  savedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.pillText,
  },
  savedChipClose: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  saveChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.pillText,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  saveInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    fontSize: 14,
    color: palette.pillText,
  },
  saveConfirm: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  saveConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveCancel: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
