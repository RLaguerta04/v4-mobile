import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MmiIcon } from '@/components/mmi-icon';
import { Spacing } from '@/constants/theme';
import { APP_VIEWS, AppView, VIEW_ACCENT_COLORS, VIEW_ICON } from '@/contexts/auth-context';

const palette = {
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  card: '#FFFFFF',
  border: '#E7DDCC',
};

// Starting/ending Y offset for the sheet's slide animation — well past the
// sheet's own height, so it's always fully off-screen at rest.
const SHEET_OFFSCREEN_Y = 300;

export function ViewSwitcher({
  value,
  onChange,
  variant = 'header',
}: {
  value: AppView;
  onChange: (view: AppView) => void;
  variant?: 'header' | 'row' | 'logo';
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;

  function openMenu() {
    setModalVisible(true);
  }

  // Overlay fades in/out on its own timeline while the sheet slides
  // separately — Modal's built-in animationType moves both as one block,
  // which makes the backdrop appear to slide up with the sheet instead of
  // just dimming the screen. Same pattern as the mention card's options sheet.
  function closeMenu() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  }

  useEffect(() => {
    if (!modalVisible) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSCREEN_Y);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalVisible]);

  return (
    <>
      {variant === 'logo' ? (
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Current view: ${value}. Tap to switch`}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <MmiIcon size={26} color={VIEW_ACCENT_COLORS[value]} />
        </Pressable>
      ) : variant === 'row' ? (
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`App view: ${value}. Tap to change`}
          style={({ pressed }) => [styles.rowTrigger, pressed && styles.pressed]}>
          <Ionicons name="grid-outline" size={20} color={palette.text} />
          <Text style={styles.rowTriggerLabel}>App View</Text>
          <Text style={styles.rowTriggerValue}>{value}</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
        </Pressable>
      ) : (
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Current view: ${value}. Tap to switch`}
          style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
          <Text style={styles.triggerText}>{value}</Text>
          <Ionicons name="chevron-down" size={14} color={palette.text} />
        </Pressable>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeMenu}>
        <View style={styles.sheetContainer}>
          <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeMenu}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            />
          </Animated.View>

          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            {APP_VIEWS.map((view) => {
              const selected = view === value;
              const viewColor = VIEW_ACCENT_COLORS[view];
              return (
                <Pressable
                  key={view}
                  onPress={() => {
                    closeMenu();
                    if (view !== value) {
                      onChange(view);
                      // Reset to Home so you never land on a page the newly
                      // selected workspace's navigation doesn't expose.
                      router.replace('/');
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    selected && { backgroundColor: `${viewColor}1A` },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.sheetRowLabel}>
                    <View style={[styles.viewBadge, { backgroundColor: viewColor }]}>
                      <Ionicons name={VIEW_ICON[view]} size={17} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.sheetRowText, selected && { color: viewColor, fontWeight: '700' }]}>
                      {view}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={18} color={viewColor} />}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  rowTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowTriggerLabel: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
  },
  rowTriggerValue: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sheetRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.text,
  },
});
