// A slide-up sheet listing a set of articles as ArticleCards — used by the
// Dashboard's Explore drill-downs and Search "see all". Pull-to-dismiss, same
// shell as the other MediaWatch sheets.
import { useRef } from 'react';
import { Animated, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackToTop, useScrollToTop } from '@/components/back-to-top';
import { ArticleCard } from '@/components/mediawatch/article-card';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SheetHeader } from '@/components/sheet-header';
import { Spacing } from '@/constants/theme';
import type { NewsArticle } from '@/data/mediawatch-types';

export function ArticleListSheet({
  visible,
  title,
  subtitle,
  articles,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  articles: NewsArticle[];
  onClose: () => void;
}) {
  const listRef = useRef<FlatList>(null);
  const { visible: showTop, onScroll: onScrollTop } = useScrollToTop();
  const dismiss = useDismissGesture(onClose);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.screen}>
        <Animated.View style={[styles.fill, dismiss.style]}>
          <GestureDetector gesture={dismiss.gesture}>
            <View>
              <SheetHeader onClose={onClose} title={title} />
            </View>
          </GestureDetector>

          <FlatList
            ref={listRef}
            data={articles}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              onScrollTop(e);
              dismiss.onScroll(e);
            }}
            scrollEventThrottle={16}
            ListHeaderComponent={
              subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null
            }
            renderItem={({ item }) => <ArticleCard article={item} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.empty}>No articles.</Text>}
          />
        </Animated.View>
        <BackToTop visible={showTop} anchor="safe" onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF8F4' },
  fill: { flex: 1 },
  body: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  subtitle: { fontSize: 13, color: '#6B7280', marginBottom: Spacing.three },
  separator: { height: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7DDCC', marginBottom: Spacing.three },
  empty: { textAlign: 'center', color: '#8A8580', paddingTop: Spacing.six },
});
