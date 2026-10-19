import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Theme } from '@/constants/theme';
import { ThemeMode, useAccentColor, useTheme, useThemeMode } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type IoniconName = keyof typeof Ionicons.glyphMap;

const OPTIONS: { mode: ThemeMode; label: string; icon: IoniconName }[] = [
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
];

// Segmented Appearance control: follow the OS, or force light/dark. Drives the
// app-wide ThemeProvider mode. The selected segment is tinted with the active
// view's accent so it matches the rest of the UI.
export function ThemeToggle() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const accent = useAccentColor();
  const { mode, setMode } = useThemeMode();

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <Pressable
            key={o.mode}
            onPress={() => setMode(o.mode)}
            accessibilityRole="radio"
            accessibilityLabel={`${o.label} appearance`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: `${accent}1A`, borderColor: accent },
              pressed && styles.pressed,
            ]}>
            <Ionicons name={o.icon} size={16} color={active ? accent : theme.textSecondary} />
            <Text style={[styles.segmentText, { color: active ? accent : theme.textSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.two + 2,
      borderRadius: Spacing.two + 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.6,
    },
  });
