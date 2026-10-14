// Reusable "back to top" affordance shared by every scrollable screen.
//
// `useScrollToTop` tracks whether the user has scrolled past a threshold and
// returns an onScroll handler to attach to a FlatList/ScrollView. `<BackToTop>`
// is the floating button that fades in when visible; each screen wires its own
// scroll-to-top call (scrollToOffset for FlatList, scrollTo for ScrollView) so
// the same pieces work for both without special-casing.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

export function useScrollToTop(threshold = 500) {
  const [visible, setVisible] = useState(false);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > threshold;
      setVisible((prev) => (prev === next ? prev : next));
    },
    [threshold],
  );
  const reset = useCallback(() => setVisible(false), []);
  return { visible, onScroll, reset };
}

export function BackToTop({
  visible,
  onPress,
  bottomOffset = 0,
  anchor = 'tabbar',
}: {
  visible: boolean;
  onPress: () => void;
  bottomOffset?: number;
  // 'tabbar' sits above the bottom tab bar (tab screens); 'safe' sits just
  // above the bottom safe-area (full-screen modals that have no tab bar).
  anchor?: 'tabbar' | 'safe';
}) {
  const { accentColor } = useAuth();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  if (!mounted) return null;

  // 'tabbar': above the bottom tab bar (height mirrors app-tabs' BarContainer).
  // 'safe': just above the bottom safe-area, for modals without a tab bar.
  const tabBarHeight = 54 + Math.max(insets.bottom, 10);
  const baseBottom = anchor === 'safe' ? insets.bottom + Spacing.four : tabBarHeight + Spacing.two;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        {
          bottom: baseBottom + bottomOffset,
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Scroll to top"
        style={({ pressed }) => [styles.btn, { backgroundColor: accentColor }, pressed && styles.pressed]}>
        <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: Spacing.three,
    zIndex: 50,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});
