import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Theme } from '@/constants/theme';
import { useAccentColor } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';

// One consistent heading for every primary screen: a large Inter Tight title
// and a one-line description in the app's editorial voice ("{phrase} · {N}"),
// with the count rendered in the user's accent color so the number pops and all
// pages share the same hierarchy.
export function PageHeading({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const accentColor = useAccentColor();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {description}
        {count !== undefined ? (
          <Text>
            {' · '}
            <Text style={[styles.count, { color: accentColor }]}>{count}</Text>
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: Spacing.half,
    },
    title: {
      fontSize: 22,
      lineHeight: 26,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: t.text,
    },
    description: {
      fontSize: 13,
      color: t.textSecondary,
    },
    count: {
      fontWeight: '700',
    },
  });
