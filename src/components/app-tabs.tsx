import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Tabs, TabList, TabListProps, TabTrigger, TabTriggerSlotProps, TabSlot } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrowseCategoriesModal } from '@/components/browse-categories-modal';
import { SavedArticlesModal } from '@/components/saved-articles-modal';
import { useAuth } from '@/contexts/auth-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

// The 4 primary destinations shown in the bar. "Profile" is registered as a
// hidden tab further down (still a real route the header avatar can jump
// to), and "More" is a plain button, not a route — see MoreButton below.
const TABS: {
  name: string;
  href: string;
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
}[] = [
  { name: 'index', href: '/', icon: 'home-outline', iconActive: 'home', label: 'Home' },
  {
    name: 'bookmark',
    href: '/bookmark',
    icon: 'megaphone-outline',
    iconActive: 'megaphone',
    label: 'Activity',
  },
  {
    name: 'authors',
    href: '/authors',
    icon: 'grid-outline',
    iconActive: 'grid',
    label: 'Dashboard',
  },
  {
    name: 'search',
    href: '/search',
    icon: 'search-outline',
    iconActive: 'search',
    label: 'Search',
  },
];

export default function AppTabs() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [savedArticlesOpen, setSavedArticlesOpen] = useState(false);

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BarContainer>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} asChild>
              <TabButton icon={tab.icon} iconActive={tab.iconActive} label={tab.label} />
            </TabTrigger>
          ))}
          {/* Registered so the header avatar (a standalone TabTrigger
              elsewhere) can still navigate here, without showing a button
              for it in the visible bar. */}
          <TabTrigger name="profile" href="/profile" style={styles.hiddenTrigger} />
          <MoreButton onPress={() => setMoreOpen(true)} />
        </BarContainer>
      </TabList>

      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSelectCategories={() => setCategoriesOpen(true)}
        onSelectSavedArticles={() => setSavedArticlesOpen(true)}
      />
      <BrowseCategoriesModal visible={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <SavedArticlesModal visible={savedArticlesOpen} onClose={() => setSavedArticlesOpen(false)} />
    </Tabs>
  );
}

function TabButton({
  icon,
  iconActive,
  label,
  isFocused,
  style,
  ...props
}: TabTriggerSlotProps & { icon: IoniconName; iconActive: IoniconName; label: string }) {
  const { accentColor } = useAuth();
  const activeColor = isFocused ? accentColor : Colors.inactive;

  return (
    <Pressable
      {...props}
      style={(state) => [typeof style === 'function' ? style(state) : style, styles.tabButton]}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}>
      <Ionicons name={isFocused ? iconActive : icon} size={23} color={activeColor} />
      <Text style={[styles.tabLabel, { color: activeColor }]}>{label}</Text>
    </Pressable>
  );
}

// Looks like a tab button but isn't a route — opens the More sheet instead
// of navigating. Kept as a plain component (not a TabTrigger) since relying
// on canceling a TabTrigger's navigation isn't a reliably supported native
// behavior, only a documented web-link convenience.
function MoreButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityLabel="More">
      <Ionicons name="ellipsis-horizontal" size={23} color={Colors.inactive} />
      <Text style={[styles.tabLabel, { color: Colors.inactive }]}>More</Text>
    </Pressable>
  );
}

function BarContainer(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const { hideProgress } = useTabBarVisibility();
  const barHeight = 54 + Math.max(insets.bottom, 10);

  return (
    <Animated.View
      {...props}
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 10) },
        {
          opacity: hideProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            {
              translateY: hideProgress.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight] }),
            },
          ],
        },
      ]}>
      {props.children}
    </Animated.View>
  );
}

const SHEET_OFFSCREEN_Y = 300;

function MoreSheet({
  visible,
  onClose,
  onSelectCategories,
  onSelectSavedArticles,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectCategories: () => void;
  onSelectSavedArticles: () => void;
}) {
  const router = useRouter();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;
  const [rendered, setRendered] = useState(visible);

  function animateClosed() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setRendered(false));
  }

  useEffect(() => {
    if (visible) {
      setRendered(true);
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
    } else if (rendered) {
      animateClosed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={rendered} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.sheetHandle} />
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              onClose();
              // Dashboard tab already shows this same screen — this is just
              // a second, discoverable entry point to it from More.
              router.push('/authors');
            }}
            accessibilityRole="button">
            <Ionicons name="stats-chart-outline" size={20} color={Colors.text} />
            <Text style={styles.sheetRowText}>Influencers</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              onClose();
              // Activity tab already shows this same screen — this is just
              // a second, discoverable entry point to it from More.
              router.push('/bookmark');
            }}
            accessibilityRole="button">
            <Ionicons name="bookmark-outline" size={20} color={Colors.text} />
            <Text style={styles.sheetRowText}>Bookmarks</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              onClose();
              onSelectSavedArticles();
            }}
            accessibilityRole="button">
            <Ionicons name="file-tray-full-outline" size={20} color={Colors.text} />
            <Text style={styles.sheetRowText}>Saved Articles</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              onClose();
              onSelectCategories();
            }}
            accessibilityRole="button">
            <Ionicons name="apps-outline" size={20} color={Colors.text} />
            <Text style={styles.sheetRowText}>Categories</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const Colors = {
  bar: '#FFFFFF',
  inactive: '#8A8A8E',
  border: '#E7DDCC',
  text: '#1A1A1A',
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: Colors.bar,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    // Explicit, not just the View/Pressable default — expo-router/ui's
    // TabTrigger injects its own `style` (via asChild) that can set
    // flexDirection: 'row', and RN's array-style merge keeps a key from an
    // earlier object when a later one doesn't mention it, so leaving this
    // unset let the injected row direction win and rendered icon+label
    // side-by-side instead of stacked.
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  hiddenTrigger: {
    display: 'none',
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
    backgroundColor: Colors.bar,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  sheetRowPressed: {
    opacity: 0.6,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
});
