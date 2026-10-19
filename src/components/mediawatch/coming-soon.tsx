// Temporary placeholder for MediaWatch-only pages that are wired into
// navigation before their full screens land. Replaced per phase.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageHeading } from '@/components/page-heading';
import { Spacing, Theme } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export function ComingSoon({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <PageHeading title={title} description={subtitle ?? 'MediaWatch'} />
      </View>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={40} color={theme.textSecondary} />
        <Text style={styles.text}>This MediaWatch page is being set up.</Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingBottom: 80 },
  text: { fontSize: 15, color: t.textSecondary },
});
