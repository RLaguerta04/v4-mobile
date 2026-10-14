import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { CATEGORY_TAXONOMY } from '@/data/taxonomy';

const palette = {
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  card: '#FFFFFF',
  border: '#E7DDCC',
};

// Starting/ending Y offset for the sheet's slide animation — well past the
// sheet's own height, so it's always fully off-screen at rest.
const SHEET_OFFSCREEN_Y = 400;

// Header-level category picker — broad, quick context switch. Bucket/keyword
// level refinement within a category lives in the Filters panel instead.
// Always resolves to one of the real categories — no "All Categories" state.
export function CategoryDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (category: string) => void;
}) {
  const { accentColor } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
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
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={`Category: ${value}. Tap to change`}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-down" size={14} color={palette.text} />
      </Pressable>

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
            <Text style={styles.sheetTitle}>Category</Text>
            {CATEGORY_TAXONOMY.map((category) => (
              <Row
                key={category.name}
                label={category.name}
                selected={value === category.name}
                accentColor={accentColor}
                onPress={() => {
                  closeMenu();
                  onChange(category.name);
                }}
              />
            ))}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function Row({
  label,
  selected,
  accentColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.sheetRow,
        selected && { backgroundColor: `${accentColor}1A` },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.sheetRowText, selected && { color: accentColor, fontWeight: '700' }]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={accentColor} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 190,
    maxWidth: 190,
  },
  triggerText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    flexShrink: 1,
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
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textSecondary,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.text,
  },
});
