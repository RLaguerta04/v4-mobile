/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Light theme values are the real Media Meter v4 design system tokens,
// extracted from V4 Client FINAL/design-system.html (--ink, --canvas,
// --surface, --border, --muted). No dark-mode spec exists in that design
// system, so dark stays as a reasonable placeholder.
export const Colors = {
  light: {
    text: '#181D26',
    background: '#F5F4F0',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4E6EA',
    textSecondary: '#6B7280',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Semantic + accent tokens from the same design system, for sentiment
// indicators, tags, and highlights (not part of the light/dark text/surface
// pairing above).
export const MediaMeterColors = {
  positive: '#16A34A',
  negative: '#E94F37',
  neutralSentiment: '#9CA3AF',
  aveGreen: '#16A34A',
  pastelLilac: '#B9A4F7',
  pastelMint: '#86D9A8',
  pastelCoral: '#E94F37',
  pastelPink: '#F9A8B9',
  pastelCream: '#FDE2B6',
  pastelLime: '#C1E84A',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// Real Media Meter v4 type families: Inter Tight for display/headings,
// Inter for body/label/caption text (design-system.html's typography scale).
// Loaded via @expo-google-fonts in the root layout — must match those exact
// PostScript names.
export const AppFonts = {
  displayBold: 'InterTight_700Bold',
  displaySemiBold: 'InterTight_600SemiBold',
  textRegular: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textSemiBold: 'Inter_600SemiBold',
  textBold: 'Inter_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
