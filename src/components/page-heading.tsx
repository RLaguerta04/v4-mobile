import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

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
  const { accentColor } = useAuth();
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

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.half,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#1A1A1A',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
  },
  count: {
    fontWeight: '700',
  },
});
