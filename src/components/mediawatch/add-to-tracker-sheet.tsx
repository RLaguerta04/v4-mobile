// "Add to Tracker" picker — web parity with the reference's at-track-menu
// (openTrackArtMenu/atTrackToggle in app.js): a togglable list of activities
// plus a shortcut to create a new one from this article/post. Simplified from
// the web version for mobile — no search box or keyword-overlap "Recommended"
// sorting, since the activity list here is short enough to just scroll.
// Presentational: the owning tracker (MediaWatch article tracker or SharedView
// social tracker) passes its activities + mutators in, so both workspaces reuse
// this one sheet.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewActivityModal } from '@/components/new-activity-modal';
import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { ActivityType, TrackerActivity, TrackerMatch } from '@/data/types';

// Start-of-slide offset before the sheet's real height is measured. Bigger than
// any plausible sheet so the first open still begins fully off-screen; once laid
// out, the measured height drives the travel exactly.
const SHEET_FALLBACK_Y = 700;

export function AddToTrackerSheet({
  visible,
  match,
  activities,
  toggleMatch,
  createActivityWithMatch,
  onClose,
}: {
  visible: boolean;
  match: TrackerMatch;
  activities: TrackerActivity[];
  toggleMatch: (activityId: number, match: TrackerMatch) => void;
  createActivityWithMatch: (title: string, type: ActivityType, match: TrackerMatch) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accentColor = useAccentColor();
  const [newActivityOpen, setNewActivityOpen] = useState(false);

  // Keep the Modal mounted through the close animation so the exit actually
  // plays before it unmounts. The backdrop fades in place on its own timeline
  // while the sheet slides separately — Modal's native animationType would move
  // both as one block, dragging the dim layer up with the sheet.
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SHEET_FALLBACK_Y)).current;
  const sheetHeight = useRef(SHEET_FALLBACK_Y);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdrop.setValue(0);
      translateY.setValue(sheetHeight.current);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: sheetHeight.current,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, Spacing.three), transform: [{ translateY }] },
          ]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add to activity</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {activities.map((activity) => {
              const inIt = activity.matches.some((m) => m.title === match.title);
              return (
                <Pressable
                  key={activity.id}
                  onPress={() => toggleMatch(activity.id, match)}
                  accessibilityRole="button"
                  accessibilityState={{ checked: inIt }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <View style={[styles.rowIcon, inIt && { backgroundColor: accentColor }]}>
                    <Ionicons name={inIt ? 'checkmark' : 'add'} size={16} color={inIt ? '#FFFFFF' : theme.textSecondary} />
                  </View>
                  <Text style={styles.rowText} numberOfLines={1}>
                    {activity.title}
                  </Text>
                </Pressable>
              );
            })}
            {activities.length === 0 && <Text style={styles.emptyText}>No activities yet.</Text>}
          </ScrollView>

          <Pressable
            onPress={() => setNewActivityOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.newRow, pressed && styles.rowPressed]}>
            <Ionicons name="folder-open-outline" size={18} color={accentColor} />
            <Text style={[styles.newRowText, { color: accentColor }]}>New activity from this article</Text>
          </Pressable>
        </Animated.View>
      </View>

      <NewActivityModal
        visible={newActivityOpen}
        onClose={() => setNewActivityOpen(false)}
        onCreate={(activity) => {
          createActivityWithMatch(activity.title, activity.type, match);
          onClose();
        }}
      />
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.scrim,
  },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: Spacing.two,
  },
  title: { fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: Spacing.two },
  list: { flexGrow: 0 },
  listContent: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  rowPressed: { opacity: 0.6 },
  rowIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.track,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
  emptyText: { fontSize: 14, color: theme.textSecondary, paddingVertical: Spacing.two },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginTop: Spacing.one,
  },
  newRowText: { fontSize: 15, fontWeight: '700' },
});
