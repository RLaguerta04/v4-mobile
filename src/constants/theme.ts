/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Light theme values are the real Media Meter v4 design system tokens,
// extracted from V4 Client FINAL/design-system.html (--ink, --canvas,
// --surface, --border, --muted). Dark is a neutral-gray elevated system: a
// near-black canvas (#0F0F0F) with cards (#222222) set a clear luminance step
// above it and each surface layer (detail-bg < card < raised < selected)
// stepping lighter, so cards read as genuinely raised rather than blending in.
//
// Every token below exists in BOTH schemes with identical keys, so a
// component can read `theme.<token>` without caring which scheme is active.
// The first five keys (text/background/backgroundElement/backgroundSelected/
// textSecondary) are the legacy names ThemedText/ThemedView still address by
// `type`/`themeColor`; the rest are the semantic surface/line/chrome tokens
// the rest of the UI migrates onto.
export const Colors = {
  light: {
    // text
    text: '#1A1A1A',
    textSecondary: '#8A8580', // warm muted — the dominant card secondary
    textTertiary: '#9CA3AF', // axis / faint labels
    // surfaces
    background: '#F5F4F0', // app canvas
    card: '#FFFFFF', // raised card / sheet
    surfaceWarm: '#FAF8F4', // full-screen detail + modal background
    elevated: '#E4E6EA', // selected / pressed raised fill
    track: '#EDE6D8', // progress tracks, image placeholders
    topicBg: '#F0E9DC', // warm pill / chip background
    // lines
    border: '#E7DDCC', // warm hairline / card border
    borderCool: '#E4E6EA', // cool divider (dashboard, chips)
    hairline: '#E7DDCC',
    // card outline — shown in light (white cards need an edge on the light
    // canvas), transparent in dark (the elevated fill already separates them).
    // `cardBorder` is the warm edge; `cardBorderCool` the cool one (matches the
    // cards that use borderCool/#E4E6EA). Both vanish in dark.
    cardBorder: '#E7DDCC',
    cardBorderCool: '#E4E6EA',
    // chrome
    tabBar: '#FFFFFF',
    tabInactive: '#8A8A8E',
    // semantic accents (hue-stable; see dark for the lightened on-dark set)
    positive: '#16A34A',
    negative: '#E94F37',
    warning: '#D97706',
    info: '#2563EB',
    neutral: '#9CA3AF',
    danger: '#DC2626', // destructive actions (delete / remove) — distinct red
    // inverse surface — the "selected / primary-action" fill, always carrying a
    // white label. Near-black in light; an elevated mid-gray in dark (NOT the
    // near-black card color) so selected chips, active tabs, and primary CTAs
    // stay clearly visible instead of vanishing into the dark card.
    inverse: '#1A1A1A',
    // misc
    scrim: 'rgba(26, 26, 26, 0.4)', // modal backdrop
    onColor: '#FFFFFF', // text/icons sitting on an accent or photo
    isDark: false,
    statusBarStyle: 'dark' as const,
    // legacy aliases (ThemedText/ThemedView address these by name)
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4E6EA',
  },
  dark: {
    // text — cool near-whites, matching the elevated cool-charcoal surfaces
    text: '#F4F5F7',
    textSecondary: '#9CA0A8',
    textTertiary: '#6B6F77',
    // surfaces — neutral dark grays stepping canvas < detail-bg < card < raised
    // < selected, so each layer reads as clearly lifted off the one below it.
    background: '#0F0F0F', // near-black canvas
    card: '#222222', // raised card / sheet — clearly above canvas
    surfaceWarm: '#171717', // full-screen detail + modal background (sits between)
    elevated: '#2E2E2E', // selected / pressed raised fill (above the card)
    track: '#2E2E2E', // progress tracks, image placeholders
    topicBg: '#2A2A2A', // pill / chip background
    // lines — a thin lighter edge, visible on the #222222 card
    border: '#333333',
    borderCool: '#333333',
    hairline: 'rgba(255, 255, 255, 0.08)',
    // no card outline in dark — the elevated fill separates cards on its own
    cardBorder: 'transparent',
    cardBorderCool: 'transparent',
    // chrome
    tabBar: '#1A1A1A', // lifted off the canvas
    tabInactive: '#8A8E96',
    // semantic accents — lightened to clear AA on the near-black canvas
    positive: '#22C55E',
    negative: '#FF6B5B',
    warning: '#F59E0B',
    info: '#60A5FA',
    neutral: '#8A8E96',
    danger: '#F87171',
    // inverse surface — mid-gray (well above card #222222 and elevated #2E2E2E)
    // so an active/selected pill with a white label clearly stands out.
    inverse: '#4A4A4A',
    // misc
    scrim: 'rgba(0, 0, 0, 0.6)',
    onColor: '#FFFFFF',
    isDark: true,
    statusBarStyle: 'light' as const,
    // legacy aliases
    backgroundElement: '#222222',
    backgroundSelected: '#2E2E2E',
  },
} as const;

// Widen each token to `string` (both schemes hold different string literals
// under `as const`, so the raw `typeof Colors.light` wouldn't accept the dark
// object). statusBarStyle stays a narrow union so it's valid for <StatusBar>.
export type Theme = {
  [K in keyof typeof Colors.light]: K extends 'statusBarStyle'
    ? 'light' | 'dark'
    : K extends 'isDark'
      ? boolean
      : string;
};
// Only the string-valued (color) tokens — excludes the boolean `isDark` so
// ThemedText/ThemedView's `theme[themeColor]` always resolves to a color value.
export type ThemeColor = {
  [K in keyof typeof Colors.light]: (typeof Colors.light)[K] extends string ? K : never;
}[keyof typeof Colors.light];

// Semantic + accent tokens. These are hue-stable across schemes, but small
// text/icons need lightened variants on a dark canvas to stay legible — the
// `onDark` set below is tuned to clear WCAG AA (4.5:1) on #121110.
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

// Scheme-aware semantic accents. Green/coral/amber already clear AA on the
// warm-charcoal canvas, but are nudged brighter for vibrancy; blue and the
// brand purples fail as small text on dark, so they get genuinely lighter
// variants (see the contrast table in the dark-mode plan).
export const SemanticColors = {
  light: {
    positive: '#16A34A',
    negative: '#E94F37',
    warning: '#D97706',
    info: '#2563EB',
    neutral: '#9CA3AF',
  },
  dark: {
    positive: '#22C55E',
    negative: '#FF6B5B',
    warning: '#F59E0B',
    info: '#60A5FA',
    neutral: '#8A8E96',
  },
} as const;

// Per-view brand accents (auth-context's VIEW_ACCENT_COLORS) mapped to their
// on-dark replacements. Blue 2563EB (4.1:1) and purple 7C3AED (~4:1) are too
// dim as small UI on dark; coral is fine but lifted slightly to match.
export const AccentOnDark: Record<string, string> = {
  '#2563EB': '#60A5FA', // SharedView blue
  '#E94F37': '#FF6B5B', // MediaWatch coral
  '#7C3AED': '#A78BFA', // AdWatch purple
  '#6B4DE8': '#8B6FF0', // secondary indigo
};

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
