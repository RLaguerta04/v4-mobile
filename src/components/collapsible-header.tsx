// A floating screen header that slides up / fades out as `progress` animates
// 0 → 1 (shown → hidden), mirroring the Home feed's top bar. It owns the top
// safe-area inset, measures its own height (reported via onHeightChange so the
// list below can reserve space), and paints a status-bar backdrop so the notch
// area stays clean while the header is tucked away. Pair with useHideOnScroll.
import { ReactNode, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CollapsibleHeader({
  progress,
  onHeightChange,
  backgroundColor = '#F5F4F0',
  children,
}: {
  progress: Animated.Value;
  onHeightChange: (height: number) => void;
  backgroundColor?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - height) > 0.5) {
      setHeight(h);
      onHeightChange(h);
    }
  }

  return (
    <>
      {/* Always-visible backdrop behind the status bar, so when the header
          slides away the status icons still sit over a solid strip. */}
      <View style={[styles.statusBackdrop, { height: insets.top, backgroundColor }]} pointerEvents="none" />
      <Animated.View
        onLayout={onLayout}
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) },
            ],
          },
        ]}>
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  statusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
