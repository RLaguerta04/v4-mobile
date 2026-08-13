import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MentionCard } from '@/components/mention-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { socialMentions } from '@/data/sample-data';

const palette = {
  background: '#F5F4F0',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
};

export default function BookmarkScreen() {
  const { savedUrls, isSaved, toggleSave } = useBookmarks();
  const savedMentions = socialMentions.filter((mention) => savedUrls.has(mention.url));

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Mentions you've saved for later</Text>
        </View>

        <FlatList
          data={savedMentions}
          keyExtractor={(item) => item.url}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <MentionCard mention={item} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Tap the bookmark icon on a mention to save it here.
            </Text>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
