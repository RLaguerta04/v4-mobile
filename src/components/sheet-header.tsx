// Shared header for overlay / detail screens. Title (or breadcrumb) on the
// left, optional extra actions, and a consistent ✕ Close button pinned to the
// right — so every sheet dismisses the same way, in the same place, with the
// same styling. Owns the top safe-area inset like the headers it replaces.
//
// When `dragHandlers` (from useDismissGesture) are provided, the whole bar
// becomes a pull-down-to-dismiss handle and shows a grabber; taps on the ✕ /
// actions still work since the gesture only grabs clear downward drags.
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

const C = {
  text: '#181D26',
  bg: '#FFFFFF',
  border: '#E4E6EA',
  muted: '#6B7280',
  faint: '#9CA3AF',
  grabber: '#D4D1CC',
};

export function SheetHeader({
  onClose,
  title,
  breadcrumb,
  rightActions,
  children,
}: {
  onClose: () => void;
  title?: string;
  breadcrumb?: { current: string; overview?: string };
  rightActions?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.one }]}>
      <View style={styles.grabber} />
      <View style={styles.row}>
        <View style={styles.left}>
          {children ? (
            children
          ) : breadcrumb ? (
            <View style={styles.crumb}>
              <Text style={styles.crumbOverview}>{breadcrumb.overview ?? 'Overview'}</Text>
              <Text style={styles.crumbSep}> / </Text>
              <Text style={styles.crumbCurrent} numberOfLines={1}>
                {breadcrumb.current}
              </Text>
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>

        {rightActions ? <View style={styles.actions}>{rightActions}</View> : null}

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
          <Ionicons name="close" size={24} color={C.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.grabber,
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  left: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crumbOverview: {
    fontSize: 13,
    color: C.muted,
  },
  crumbSep: {
    fontSize: 13,
    color: C.faint,
  },
  crumbCurrent: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
