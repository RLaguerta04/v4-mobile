import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';

import { SocialMention } from '@/data/types';

// Pre-styled brand icons (color + circular background already baked into
// the source image) — render directly, no extra background/shape needed.
export const PLATFORM_ICON: Record<SocialMention['platform'], ImageSourcePropType> = {
  facebook: require('@/assets/images/social-icons/facebook.png'),
  twitter: require('@/assets/images/social-icons/x.png'),
  instagram: require('@/assets/images/social-icons/instagram.png'),
  youtube: require('@/assets/images/social-icons/youtube.png'),
  reddit: require('@/assets/images/social-icons/reddit.png'),
  tiktok: require('@/assets/images/social-icons/tiktok.png'),
};

// Sample data has no real author photos, so each handle gets a deterministic
// initials avatar instead — same handle always maps to the same color/letter.
const AVATAR_COLORS = ['#6059A6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

function getAvatarColor(handle: string): string {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = handle.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getAvatarInitial(handle: string): string {
  const cleaned = handle.replace(/^[@#]/, '').replace(/^u\//, '');
  return cleaned.charAt(0).toUpperCase();
}

// Shared between the Mentions feed cards and the Home screen's Authors row,
// so the same handle always renders as the exact same avatar everywhere.
export function AuthorAvatar({
  handle,
  platform,
  size = 36,
}: {
  handle: string;
  platform: SocialMention['platform'];
  size?: number;
}) {
  // Badge is sized/offset proportionally so this still looks right at the
  // Authors row's larger size, not just the card's default 36px.
  const badgeSize = Math.round(size * (16 / 36));
  const badgeOffset = -Math.round(size * (2 / 36));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatarCircle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: getAvatarColor(handle) },
        ]}>
        <Text style={[styles.avatarInitial, { fontSize: size * (15 / 36) }]}>{getAvatarInitial(handle)}</Text>
      </View>
      <View
        style={[
          styles.platformBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: badgeOffset,
            bottom: badgeOffset,
          },
        ]}>
        <Image source={PLATFORM_ICON[platform]} style={styles.platformBadgeIcon} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  platformBadge: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
});
