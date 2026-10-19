// Horizontal scroll row that fades its trailing edge when there's more content
// off-screen, so users know the items are swipeable. Shared by the SharedView
// author row and the MediaWatch top-publishers row (both sit above Today's
// Brief on their Mentions feed).
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export function FadeEdgeRow({
  scrollRef,
  children,
  contentContainerStyle,
  background,
}: {
  scrollRef?: React.RefObject<ScrollView | null>;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  background?: string;
}) {
  const theme = useTheme();
  // The feed background the Mentions screens use — the fade gradient resolves
  // to this so the trailing edge blends into the page (dark or light).
  const bg = background ?? theme.background;
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const showFade = contentWidth > containerWidth + 1;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, contentContainerStyle]}
        onContentSizeChange={(w) => setContentWidth(w)}>
        {children}
      </ScrollView>
      {showFade && (
        <LinearGradient
          colors={[`${bg}00`, bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fadeEdge, { pointerEvents: 'none' }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  fadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
});
