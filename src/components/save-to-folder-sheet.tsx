// Save-to-folder picker — opened from a mention's ⋯ menu ("Add to Saved
// Articles"). Lets you file the article into a folder, create a new folder and
// file into it in one step, or (when already saved) move it or remove it.
//
// Hosting: the card's ⋯ menu lives outside any Modal, so there the picker
// renders its OWN <Modal> (host="modal"). The article-detail view is already a
// Modal and deliberately avoids nesting Modals, so there the picker renders as
// an in-tree absolute overlay (host="inline") — same slide-up/backdrop look,
// no nested Modal. Either way it self-manages its enter/exit animation off the
// `visible` prop, staying mounted through the close animation.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { FOLDER_COLORS, useSavedArticles } from '@/contexts/saved-articles-context';

const palette = {
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  faint: '#9CA3AF',
  danger: '#DC2626',
};

// Start/rest offset for the slide animation — past the sheet's own height.
const SHEET_OFFSCREEN_Y = 500;

export function SaveToFolderSheet({
  visible,
  url,
  onClose,
  host = 'modal',
}: {
  visible: boolean;
  url: string;
  onClose: () => void;
  host?: 'modal' | 'inline';
}) {
  const insets = useSafeAreaInsets();
  const { accentColor } = useAuth();
  const { folders, folderOfUrl, moveToFolder, createFolder, toggleSaveArticle } = useSavedArticles();

  const saved = url in folderOfUrl;
  const currentFolder = saved ? folderOfUrl[url] : undefined; // string | null | undefined

  const [rendered, setRendered] = useState(visible);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  // Height of the on-screen keyboard; lifts the bottom-anchored sheet above it
  // so the "New folder" input is never covered (Android's adjustResize doesn't
  // reach a Modal's window, so we drive this from the Keyboard API ourselves).
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<ScrollView>(null);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setCreating(false);
      setNewName('');
      setKeyboardHeight(0);
      backdrop.setValue(0);
      translateY.setValue(SHEET_OFFSCREEN_Y);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SHEET_OFFSCREEN_Y,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Track the keyboard only while the sheet is open, so just the active picker
  // listens (not every card's mounted-but-hidden instance).
  useEffect(() => {
    if (!rendered) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [rendered]);

  const countInFolder = (id: string) =>
    Object.values(folderOfUrl).filter((fid) => fid === id).length;

  function requestClose() {
    Keyboard.dismiss();
    onClose();
  }
  function confirm(name: string) {
    Keyboard.dismiss();
    // Lightweight, native confirmation where it's free; elsewhere the checkmark
    // (on reopen) and the card's filled icon convey the saved state.
    if (Platform.OS === 'android') ToastAndroid.show(`Saved to ${name}`, ToastAndroid.SHORT);
    onClose();
  }
  function fileInto(folderId: string | null, name: string) {
    moveToFolder(url, folderId); // adds the article if it wasn't saved yet
    confirm(name);
  }
  function submitNew() {
    const folder = createFolder(newName);
    if (!folder) return;
    moveToFolder(url, folder.id);
    confirm(folder.name);
  }
  function removeSave() {
    toggleSaveArticle(url); // currently saved → removes
    onClose();
  }

  if (!rendered) return null;

  const body = (
    <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            // No safe-area bottom padding while the keyboard is up — the sheet
            // now rests on the keyboard, not the home indicator.
            paddingBottom: keyboardHeight > 0 ? Spacing.three : Math.max(insets.bottom, Spacing.three),
            transform: [{ translateY }],
          },
        ]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{saved ? 'Move to folder' : 'Save to folder'}</Text>

        <ScrollView
          ref={listRef}
          style={styles.list}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <OptionRow
            iconName="file-tray-full-outline"
            label="All Saved"
            sub="No folder"
            selected={saved && currentFolder === null}
            accentColor={accentColor}
            onPress={() => fileInto(null, 'All Saved')}
          />

          {folders.map((f, i) => (
            <OptionRow
              key={f.id}
              folderColor={FOLDER_COLORS[i % FOLDER_COLORS.length]}
              label={f.name}
              sub={`${countInFolder(f.id)} saved`}
              selected={currentFolder === f.id}
              accentColor={accentColor}
              onPress={() => fileInto(f.id, f.name)}
            />
          ))}

          {creating ? (
            <View style={styles.createRow}>
              <View
                style={[
                  styles.folderIcon,
                  { backgroundColor: `${FOLDER_COLORS[folders.length % FOLDER_COLORS.length]}1A` },
                ]}>
                <Ionicons
                  name="folder"
                  size={18}
                  color={FOLDER_COLORS[folders.length % FOLDER_COLORS.length]}
                />
              </View>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Folder name"
                placeholderTextColor={palette.faint}
                style={styles.createInput}
                autoFocus
                onSubmitEditing={submitNew}
                returnKeyType="done"
              />
              <Pressable
                onPress={submitNew}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Create folder and save">
                <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setCreating(false);
                  setNewName('');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel new folder">
                <Ionicons name="close-circle" size={28} color={palette.faint} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setCreating(true);
                // Let the input row render, then bring it into view above the
                // keyboard even when the folder list is long.
                setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
              }}
              accessibilityRole="button"
              accessibilityLabel="New folder"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.folderIcon, styles.newIcon]}>
                <Ionicons name="add" size={20} color={palette.textSecondary} />
              </View>
              <Text style={styles.rowLabel}>New folder</Text>
            </Pressable>
          )}
        </ScrollView>

        {saved ? (
          <Pressable
            onPress={removeSave}
            accessibilityRole="button"
            accessibilityLabel="Remove from Saved Articles"
            style={({ pressed }) => [styles.removeRow, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={20} color={palette.danger} />
            <Text style={styles.removeText}>Remove from Saved Articles</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );

  if (host === 'inline') return body;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      {body}
    </Modal>
  );
}

function OptionRow({
  folderColor,
  iconName,
  label,
  sub,
  selected,
  accentColor,
  onPress,
}: {
  folderColor?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  selected: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View
        style={[
          styles.folderIcon,
          { backgroundColor: folderColor ? `${folderColor}1A` : '#F0EEE8' },
        ]}>
        <Ionicons
          name={folderColor ? 'folder' : iconName ?? 'file-tray-full-outline'}
          size={18}
          color={folderColor ?? palette.textSecondary}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={accentColor} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    marginBottom: Spacing.one,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  rowSub: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  folderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newIcon: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.faint,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    paddingVertical: Spacing.two,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  removeText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.danger,
  },
  pressed: {
    opacity: 0.6,
  },
});
