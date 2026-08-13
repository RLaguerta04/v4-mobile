import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MentionCard } from '@/components/mention-card';
import { Spacing } from '@/constants/theme';
import { useBookmarks } from '@/contexts/bookmarks-context';
import { useSavedArticles } from '@/contexts/saved-articles-context';
import { socialMentions } from '@/data/sample-data';

const palette = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
};

// "Add to Saved Articles" (in each mention card) always files into no
// folder — organizing saved items into the folders you create here isn't
// wired up yet; this covers folder creation + browsing what's saved.
export function SavedArticlesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { folders, folderOfUrl, createFolder } = useSavedArticles();
  const { isSaved, toggleSave } = useBookmarks();
  const [openFolderId, setOpenFolderId] = useState<string | 'ALL' | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const savedEntries = Object.entries(folderOfUrl);

  function countInFolder(folderId: string) {
    return savedEntries.filter(([, fid]) => fid === folderId).length;
  }

  function handleCreateFolder() {
    createFolder(newFolderName);
    setNewFolderName('');
    setCreatingFolder(false);
  }

  function reset() {
    setOpenFolderId(null);
    setCreatingFolder(false);
    setNewFolderName('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  const detailUrls =
    openFolderId === 'ALL'
      ? savedEntries.map(([url]) => url)
      : savedEntries.filter(([, fid]) => fid === openFolderId).map(([url]) => url);
  const detailArticles = socialMentions.filter((m) => detailUrls.includes(m.url));
  const detailTitle = openFolderId === 'ALL' ? 'All Saved Articles' : folders.find((f) => f.id === openFolderId)?.name;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            {openFolderId !== null ? (
              <Pressable
                onPress={() => setOpenFolderId(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={22} color={palette.text} />
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {openFolderId !== null ? detailTitle : 'Saved Articles'}
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}>
              <Ionicons name="close" size={18} color={palette.text} />
            </Pressable>
          </View>

          {openFolderId === null ? (
            <FlatList
              data={folders}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <View>
                  {savedEntries.length > 0 && (
                    <Pressable
                      style={styles.folderRow}
                      onPress={() => setOpenFolderId('ALL')}
                      accessibilityRole="button">
                      <Ionicons name="file-tray-full-outline" size={22} color={palette.text} />
                      <Text style={styles.folderName}>All Saved Articles</Text>
                      <Text style={styles.folderCount}>{savedEntries.length}</Text>
                      <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
                    </Pressable>
                  )}

                  {creatingFolder ? (
                    <View style={styles.newFolderRow}>
                      <TextInput
                        value={newFolderName}
                        onChangeText={setNewFolderName}
                        placeholder="Folder name"
                        placeholderTextColor={palette.textSecondary}
                        style={styles.newFolderInput}
                        autoFocus
                        onSubmitEditing={handleCreateFolder}
                        returnKeyType="done"
                      />
                      <Pressable
                        onPress={handleCreateFolder}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Create folder">
                        <Ionicons name="checkmark-circle" size={26} color={palette.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setCreatingFolder(false);
                          setNewFolderName('');
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel">
                        <Ionicons name="close-circle" size={26} color={palette.textSecondary} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.folderRow}
                      onPress={() => setCreatingFolder(true)}
                      accessibilityRole="button"
                      accessibilityLabel="New folder">
                      <Ionicons name="add-circle-outline" size={22} color={palette.text} />
                      <Text style={styles.folderName}>New Folder</Text>
                    </Pressable>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.folderRow}
                  onPress={() => setOpenFolderId(item.id)}
                  accessibilityRole="button">
                  <Ionicons name="folder-outline" size={22} color={palette.text} />
                  <Text style={styles.folderName}>{item.name}</Text>
                  <Text style={styles.folderCount}>{countInFolder(item.id)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
                </Pressable>
              )}
              ListEmptyComponent={
                savedEntries.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Save an article from its ⋯ menu, then create a folder to organize it here.
                  </Text>
                ) : null
              }
            />
          ) : (
            <FlatList
              data={detailArticles}
              keyExtractor={(item) => item.url}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <MentionCard mention={item} saved={isSaved(item.url)} onToggleSave={() => toggleSave(item.url)} />
              )}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
              ListEmptyComponent={<Text style={styles.emptyText}>No articles here yet.</Text>}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerSpacer: {
    width: 22,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  folderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  folderCount: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  newFolderInput: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#F5F4F0',
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
