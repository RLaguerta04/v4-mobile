import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { AppFonts, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: AppFonts.textMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: AppFonts.textBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: AppFonts.textMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: AppFonts.displaySemiBold,
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: AppFonts.displaySemiBold,
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    fontFamily: AppFonts.textRegular,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: AppFonts.textRegular,
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
