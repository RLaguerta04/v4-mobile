import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { ViewSwitcher } from '@/components/view-switcher';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

const palette = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#8A8580',
  border: '#E7DDCC',
  accent: '#E0A72E',
};

const ROWS: { icon: IoniconName; label: string }[] = [
  { icon: 'person-outline', label: 'Account' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'settings-outline', label: 'Settings' },
  { icon: 'help-circle-outline', label: 'Help & Support' },
  { icon: 'information-circle-outline', label: 'About' },
];

export default function ProfileScreen() {
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

        <View style={styles.rowList}>
          <ViewSwitcher variant="row" value={activeView ?? 'SharedView'} onChange={selectView} />
          {ROWS.map((row) => (
            <Pressable key={row.label} style={[styles.row, styles.rowDivider]} accessibilityRole="button">
              <Ionicons name={row.icon} size={20} color={palette.text} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={18} color={palette.textSecondary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
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
  identityCard: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.five,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  rowList: {
    marginHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
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
    borderTopColor: palette.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: palette.text,
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
    color: palette.textSecondary,
  },
});
