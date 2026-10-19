import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MmiIcon } from '@/components/mmi-icon';
import { Spacing, Theme } from '@/constants/theme';
import { APP_VIEWS, useAuth, VIEW_ACCENT_COLORS, VIEW_ICON } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export function ViewSelectionScreen() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { selectView } = useAuth();

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <MmiIcon size={56} color={VIEW_ACCENT_COLORS.SharedView} />
            <Text style={styles.title}>Choose your view</Text>
            <Text style={styles.subtitle}>Select how you&apos;d like to use Media Meter</Text>
          </View>

          <View style={styles.optionList}>
            {APP_VIEWS.map((view, i) => (
              <Pressable
                key={view}
                onPress={() => selectView(view)}
                style={({ pressed }) => [
                  styles.option,
                  i > 0 && styles.optionDivider,
                  pressed && styles.optionPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={view}>
                <View style={styles.optionLabel}>
                  <View style={[styles.optionBadge, { backgroundColor: VIEW_ACCENT_COLORS[view] }]}>
                    <Ionicons name={VIEW_ICON[view]} size={17} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionText}>{view}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.note}>You can change this anytime in Settings.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.six,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: t.text,
  },
  subtitle: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center',
  },
  optionList: {
    borderRadius: Spacing.three,
    backgroundColor: t.card,
    borderWidth: 1,
    borderColor: t.cardBorder,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  optionDivider: {
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  optionPressed: {
    backgroundColor: t.background,
  },
  optionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Matches the Home view switcher's viewBadge (30×30 rounded square + icon).
  optionBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: t.text,
  },
  note: {
    fontSize: 13,
    color: t.textSecondary,
    textAlign: 'center',
  },
});
