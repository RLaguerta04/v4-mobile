import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Tabs, TabList, TabListProps, TabTrigger, TabTriggerSlotProps, TabSlot } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

type TabDef = {
  name: string;
  href: string;
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
};

// The 4 primary destinations shown in the bar. The route names are identical
// across views (index/bookmark/authors/search) — only the labels/icons differ —
// because each of those screens branches its content on activeView. Hidden
// routes (profile, brief, and the view-specific More destinations) are
// registered further down.
const SHARED_TABS: TabDef[] = [
  { name: 'index', href: '/', icon: 'home-outline', iconActive: 'home', label: 'Home' },
  { name: 'bookmark', href: '/bookmark', icon: 'megaphone-outline', iconActive: 'megaphone', label: 'Activity' },
  { name: 'authors', href: '/authors', icon: 'grid-outline', iconActive: 'grid', label: 'Dashboard' },
  { name: 'search', href: '/search', icon: 'search-outline', iconActive: 'search', label: 'Search' },
];

const MEDIAWATCH_TABS: TabDef[] = [
  { name: 'index', href: '/', icon: 'newspaper-outline', iconActive: 'newspaper', label: 'Mentions' },
  { name: 'bookmark', href: '/bookmark', icon: 'megaphone-outline', iconActive: 'megaphone', label: 'Tracker' },
  { name: 'authors', href: '/authors', icon: 'grid-outline', iconActive: 'grid', label: 'Dashboard' },
  { name: 'search', href: '/search', icon: 'search-outline', iconActive: 'search', label: 'Search' },
];

type MoreItem = { href: string; label: string; icon: IoniconName; iconActive: IoniconName };

// SharedView / AdWatch keep the original More sheet; MediaWatch exposes its own
// workspace pages (Publishers, Authors, Reports, AI News Writer) alongside the
// shared Categories / Bookmarks / Saved Articles.
const SHARED_MORE: MoreItem[] = [
  { href: '/influencers', label: 'Influencers', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { href: '/bookmarks', label: 'Bookmarks', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { href: '/saved', label: 'Saved Articles', icon: 'file-tray-full-outline', iconActive: 'file-tray-full' },
  { href: '/categories', label: 'Categories', icon: 'apps-outline', iconActive: 'apps' },
];

const MEDIAWATCH_MORE: MoreItem[] = [
  { href: '/mw-publishers', label: 'Publishers', icon: 'business-outline', iconActive: 'business' },
  { href: '/mw-authors', label: 'Authors', icon: 'person-outline', iconActive: 'person' },
  { href: '/categories', label: 'Categories', icon: 'apps-outline', iconActive: 'apps' },
  { href: '/mw-reports', label: 'Reports', icon: 'document-text-outline', iconActive: 'document-text' },
  { href: '/mw-ai-writer', label: 'AI News Writer', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { href: '/bookmarks', label: 'Bookmarks', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { href: '/saved', label: 'Saved Articles', icon: 'file-tray-full-outline', iconActive: 'file-tray-full' },
];

export default function AppTabs() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { activeView } = useAuth();
  const isMediaWatch = activeView === 'MediaWatch';
  const tabs = isMediaWatch ? MEDIAWATCH_TABS : SHARED_TABS;
  const moreItems = isMediaWatch ? MEDIAWATCH_MORE : SHARED_MORE;

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BarContainer>
          {tabs.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} asChild>
              <TabButton icon={tab.icon} iconActive={tab.iconActive} label={tab.label} />
            </TabTrigger>
          ))}
          {/* Registered so the header avatar (a standalone TabTrigger
              elsewhere) can still navigate here, without showing a button
              for it in the visible bar. */}
          <TabTrigger name="profile" href="/profile" style={styles.hiddenTrigger} />
          {/* Hidden like profile: navigated to from the Today's Brief card's
              "View full brief", never shown as a bar button. */}
          <TabTrigger name="brief" href="/brief" style={styles.hiddenTrigger} />
          {/* Hidden routes reached from the More sheet (SharedView). */}
          <TabTrigger name="influencers" href="/influencers" style={styles.hiddenTrigger} />
          <TabTrigger name="bookmarks" href="/bookmarks" style={styles.hiddenTrigger} />
          <TabTrigger name="saved" href="/saved" style={styles.hiddenTrigger} />
          <TabTrigger name="categories" href="/categories" style={styles.hiddenTrigger} />
          {/* Hidden routes reached from the More sheet (MediaWatch). */}
          <TabTrigger name="mw-publishers" href={'/mw-publishers' as never} style={styles.hiddenTrigger} />
          <TabTrigger name="mw-authors" href={'/mw-authors' as never} style={styles.hiddenTrigger} />
          <TabTrigger name="mw-reports" href={'/mw-reports' as never} style={styles.hiddenTrigger} />
          <TabTrigger name="mw-ai-writer" href={'/mw-ai-writer' as never} style={styles.hiddenTrigger} />
          <MoreButton onPress={() => setMoreOpen(true)} />
        </BarContainer>
      </TabList>

      <MoreSheet visible={moreOpen} items={moreItems} onClose={() => setMoreOpen(false)} />
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
  items,
  onClose,
}: {
  visible: boolean;
  items: MoreItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { accentColor } = useAuth();
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
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Pressable
                key={item.href}
                style={({ pressed }) => [
                  styles.sheetRow,
                  active && { backgroundColor: `${accentColor}14` },
                  pressed && styles.sheetRowPressed,
                ]}
                onPress={() => {
                  onClose();
                  router.push(item.href as never);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? accentColor : Colors.text}
                />
                <Text style={[styles.sheetRowText, active && { color: accentColor, fontWeight: '700' }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
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
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 12,
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
