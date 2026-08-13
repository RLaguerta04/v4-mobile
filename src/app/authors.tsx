import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { influencers } from '@/data/sample-data';
import { InfluencerStat } from '@/data/types';

function AuthorRow({ author }: { author: InfluencerStat }) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <ThemedText type="smallBold">{author.name}</ThemedText>
      <ThemedView style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {author.followers.toLocaleString()} followers
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          engagement {author.engagementScore}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

export default function AuthorsScreen() {
  const sorted = [...influencers].sort((a, b) => b.followers - a.followers);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.handle}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Dashboard
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Influencers ranked by follower count
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => <AuthorRow author={item} />}
          ItemSeparatorComponent={() => <ThemedView style={{ height: Spacing.two }} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    gap: Spacing.one,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
  },
  row: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
