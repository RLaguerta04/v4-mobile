// Saved Articles — a first-class screen (reached from More), so the app's
// bottom tab bar stays visible and there's no modal ✕; you leave by tapping a
// tab. Replaces the old SavedArticlesModal. Hierarchy: a prominent "All Saved"
// hero, then a 2-column grid of colored folder tiles ending in a "New folder"
// tile. Tapping a folder opens its saved MentionCards in-screen (with a back
// row); the tab bar stays put throughout.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthorAvatar } from '@/components/author-avatar';
import { PageHeading } from '@/components/page-heading';
import { useDismissGesture } from '@/components/pull-to-dismiss';
import { SavedUrlCard } from '@/components/saved-url-card';
import { SheetHeader } from '@/components/sheet-header';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { FOLDER_COLORS, SavedArticleFolder, useSavedArticles } from '@/contexts/saved-articles-context';
import { socialMentions } from '@/data/sample-data';
import { resolveSavedUrls } from '@/utils/saved-resolve';

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#181D26',
  textSecondary: '#6B7280',
  faint: '#9CA3AF',
  border: '#E4E6EA',
  hero: '#1A1A35',
};

export default function SavedScreen() {
  const { folders, folderOfUrl, createFolder } = useSavedArticles();
  const [openFolderId, setOpenFolderId] = useState<string | 'ALL' | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  // Pull the header bar down (or tap ✕) to leave a folder and return to the
  // grid — same dismiss gesture the brief screen and detail sheets use.
  const dismiss = useDismissGesture(() => setOpenFolderId(null));

  const savedEntries = Object.entries(folderOfUrl);
  const totalSaved = savedEntries.length;
  const savedUrlSet = new Set(savedEntries.map(([url]) => url));
  const savedMentions = socialMentions.filter((m) => savedUrlSet.has(m.url));

  const countInFolder = (id: string) => savedEntries.filter(([, fid]) => fid === id).length;

  function submitFolder() {
    createFolder(newName);
    setNewName('');
    setCreating(false);
  }

  // ── Folder detail ──
  if (openFolderId !== null) {
    const urls =
      openFolderId === 'ALL'
        ? savedEntries.map(([url]) => url)
        : savedEntries.filter(([, fid]) => fid === openFolderId).map(([url]) => url);
    const items = resolveSavedUrls(urls);
    const title =
      openFolderId === 'ALL' ? 'All Saved Articles' : folders.find((f) => f.id === openFolderId)?.name ?? 'Folder';

    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          <Animated.View style={[styles.fill, dismiss.style]}>
            <GestureDetector gesture={dismiss.gesture}>
              <View>
                <SheetHeader onClose={() => setOpenFolderId(null)} title={title} />
              </View>
            </GestureDetector>

            <FlatList
              data={items}
              keyExtractor={(it) => it.url}
              contentContainerStyle={styles.detailList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <SavedUrlCard item={item} />}
              ItemSeparatorComponent={() => <View style={{ height: Spacing.five }} />}
              ListEmptyComponent={<Text style={styles.empty}>No articles here yet.</Text>}
            />
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Folder list (overview) ──
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <PageHeading title="Saved Articles" description="Saved for later" count={totalSaved} />
          </View>

          {totalSaved > 0 ? (
            <Pressable
              onPress={() => setOpenFolderId('ALL')}
              accessibilityRole="button"
              accessibilityLabel={`All saved articles, ${totalSaved}`}
              style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
              <View style={styles.heroLeft}>
                <View style={styles.heroIcon}>
                  <Ionicons name="file-tray-full" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>All Saved</Text>
                  <Text style={styles.heroSub}>
                    {totalSaved} {totalSaved === 1 ? 'article' : 'articles'}
                  </Text>
                </View>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.avatarStack}>
                  {savedMentions.slice(0, 4).map((m, i) => (
                    <View key={m.url} style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}>
                      <AuthorAvatar handle={m.handle} platform={m.platform} size={30} />
                    </View>
                  ))}
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </View>
            </Pressable>
          ) : null}

          <Text style={styles.sectionLabel}>Folders</Text>

          {creating ? (
            <View style={styles.createRow}>
              <View style={[styles.folderIcon, { backgroundColor: `${FOLDER_COLORS[folders.length % FOLDER_COLORS.length]}1A` }]}>
                <Ionicons name="folder" size={18} color={FOLDER_COLORS[folders.length % FOLDER_COLORS.length]} />
              </View>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Folder name"
                placeholderTextColor={palette.faint}
                style={styles.createInput}
                autoFocus
                onSubmitEditing={submitFolder}
                returnKeyType="done"
              />
              <Pressable onPress={submitFolder} hitSlop={8} accessibilityRole="button" accessibilityLabel="Create folder">
                <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setCreating(false);
                  setNewName('');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel">
                <Ionicons name="close-circle" size={28} color={palette.faint} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.grid}>
            {folders.map((f, i) => (
              <FolderTile
                key={f.id}
                folder={f}
                count={countInFolder(f.id)}
                color={FOLDER_COLORS[i % FOLDER_COLORS.length]}
                onPress={() => setOpenFolderId(f.id)}
              />
            ))}

            {!creating ? (
              <Pressable
                onPress={() => setCreating(true)}
                accessibilityRole="button"
                accessibilityLabel="New folder"
                style={({ pressed }) => [styles.tile, styles.newTile, pressed && styles.pressed]}>
                <Ionicons name="add" size={24} color={palette.textSecondary} />
                <Text style={styles.newTileText}>New folder</Text>
              </Pressable>
            ) : null}
          </View>

          {totalSaved === 0 && folders.length === 0 ? (
            <Text style={styles.empty}>
              Save an article from its ⋯ menu, then group your saves into folders here.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FolderTile({
  folder,
  count,
  color,
  onPress,
}: {
  folder: SavedArticleFolder;
  count: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${folder.name}, ${count} saved`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.folderIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name="folder" size={18} color={color} />
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {folder.name}
      </Text>
      <Text style={styles.tileCount}>
        {count} {count === 1 ? 'saved' : 'saved'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    gap: 2,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.hero,
    borderRadius: 16,
    padding: Spacing.three,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flexShrink: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.hero,
  },
  avatarOverlap: {
    marginLeft: -12,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.one,
  },

  // Folder grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: Spacing.three,
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  tileCount: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  newTile: {
    borderStyle: 'dashed',
    borderColor: palette.faint,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  newTileText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
  },

  // Inline create
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    paddingVertical: Spacing.two,
  },

  // Detail
  fill: {
    flex: 1,
  },
  detailList: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },

  empty: {
    textAlign: 'center',
    color: palette.textSecondary,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
