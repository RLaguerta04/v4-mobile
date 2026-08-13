import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MentionCard } from '@/components/mention-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { socialMentions } from '@/data/sample-data';

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
};

export default function SearchScreen() {
  const { isSaved, toggleSave } = useBookmarks();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return socialMentions.filter(
      (mention) =>
        mention.post.toLowerCase().includes(q) ||
        mention.handle.toLowerCase().includes(q) ||
        mention.entities.some((e) => e.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={palette.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search mentions, handles, topics"
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Ionicons
              name="close-circle"
              size={18}
              color={palette.textSecondary}
              onPress={() => setQuery('')}
            />
          )}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.url}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <MentionCard mention={item} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim()
                ? 'No mentions match your search.'
                : 'Search by post content, handle, or topic.'}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Spacing.three,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
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
