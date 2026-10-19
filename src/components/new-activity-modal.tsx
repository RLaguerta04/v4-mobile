import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor, useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { ActivityType, TrackerActivity } from '@/data/types';

const TYPES: ActivityType[] = ['Press Release', 'Crisis', 'Product', 'Trending', 'Event'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formatted manually (not toLocaleDateString) so it's identical across
// platforms / Hermes Intl builds.
function todayLabel(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function NewActivityModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (activity: Omit<TrackerActivity, 'id'>) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { isDark } = useThemeMode();
  // The primary "Create" + selected type chip are a fixed near-black fill in
  // light; on the dark canvas that would vanish, so they take the view accent
  // (which carries white text in both schemes) instead.
  const accentColor = useAccentColor();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityType>('Product');
  const [description, setDescription] = useState('');

  function reset() {
    setTitle('');
    setType('Product');
    setDescription('');
  }
  function handleClose() {
    reset();
    onClose();
  }
  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate({
      title: trimmed,
      type,
      date: todayLabel(),
      description: description.trim(),
      matches: [],
    });
    reset();
    onClose();
  }
  const canSave = title.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>New Activity</Text>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={({ pressed }) => [
              styles.saveBtn,
              isDark && { backgroundColor: accentColor },
              !canSave && styles.saveBtnDisabled,
              pressed && canSave && styles.pressed,
            ]}>
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Create</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Atto 2 — City EV Launch"
              placeholderTextColor={theme.textSecondary}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => {
                const on = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.typeChip,
                      on && styles.typeChipOn,
                      on && isDark && { backgroundColor: accentColor, borderColor: accentColor },
                    ]}>
                    <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this activity tracking?"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, styles.textarea]}
              multiline
            />
          </View>

          <Text style={styles.note}>
            New activities start with no matched posts — coverage is added as it&apos;s found.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.surfaceWarm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: t.card,
    borderBottomWidth: 1,
    borderBottomColor: t.borderCool,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: t.text,
  },
  saveBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    // Near-black in light; the dark scheme overrides this to the view accent
    // inline (a near-black fill would disappear on the dark canvas).
    backgroundColor: t.inverse,
  },
  saveBtnDisabled: {
    backgroundColor: t.elevated,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  saveTextDisabled: {
    color: t.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },

  body: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: t.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
    color: t.text,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: t.borderCool,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    backgroundColor: t.card,
  },
  typeChipOn: {
    // Light: near-black fill (dark scheme swaps to the view accent inline).
    backgroundColor: t.inverse,
    borderColor: t.inverse,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text,
  },
  typeChipTextOn: {
    color: '#FFFFFF',
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: t.textSecondary,
  },
});
