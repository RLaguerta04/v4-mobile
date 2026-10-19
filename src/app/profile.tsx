import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { ThemeToggle } from '@/components/theme-toggle';
import { ViewSwitcher } from '@/components/view-switcher';
import { Spacing, Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ROWS: { icon: IoniconName; label: string }[] = [
  { icon: 'person-outline', label: 'Account' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'settings-outline', label: 'Settings' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
  { icon: 'information-circle-outline', label: 'About' },
];

export default function ProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  const { signOut, activeView, selectView, accentColor } = useAuth();

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <PageHeading title="Profile" description="Your account" />
        </View>

        <View style={styles.identityCard}>
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Ionicons name="person" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.name}>Guest User</Text>
          <Text style={styles.subtitle}>BYD Mentions prototype account</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <ThemeToggle />
        </View>

        <View style={styles.rowList}>
          <ViewSwitcher variant="row" value={activeView ?? 'SharedView'} onChange={selectView} />
          {ROWS.map((row) => (
            <Pressable key={row.label} style={[styles.row, styles.rowDivider]} accessibilityRole="button">
              <Ionicons name={row.icon} size={20} color={theme.text} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
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
      color: t.text,
    },
    identityCard: {
      alignItems: 'center',
      gap: Spacing.half,
      paddingVertical: Spacing.five,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.two,
    },
    name: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
    },
    subtitle: {
      fontSize: 13,
      color: t.textSecondary,
    },
    section: {
      marginHorizontal: Spacing.four,
      marginBottom: Spacing.four,
      gap: Spacing.two,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    rowList: {
      marginHorizontal: Spacing.four,
      borderRadius: Spacing.three,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.cardBorder,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      color: t.text,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      marginHorizontal: Spacing.four,
      marginTop: Spacing.four,
      paddingVertical: Spacing.three,
    },
    signOutText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.textSecondary,
    },
  });
