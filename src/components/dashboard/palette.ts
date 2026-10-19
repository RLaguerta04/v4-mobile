// Shared color + formatting constants for the Dashboard charts, ported from
// the web client's dashboard palette (v4-client/shared/dashboard.html inline
// styles + colors_and_type.css). Platform brand colors match the KPI avatars;
// the chart variant nudges the two near-black platforms (X, TikTok) apart so
// stacked bars and legends stay legible on a phone.
import { MediaMeterColors } from '@/constants/theme';
import { useTheme, useThemeMode } from '@/contexts/theme-context';
import { Sentiment, SocialPlatform } from '@/data/types';

// Brand colors exactly as the web KPI-card avatars use them.
export const PLATFORM_COLOR: Record<SocialPlatform, string> = {
  facebook: '#1877F2',
  twitter: '#000000',
  instagram: '#E4405F',
  youtube: '#FF0000',
  tiktok: '#111111',
  reddit: '#FF4500',
};

// Chart-series variant: same hues, but X and TikTok are separated so a
// stacked share bar never shows two indistinguishable black segments.
export const PLATFORM_CHART_COLOR: Record<SocialPlatform, string> = {
  facebook: '#1877F2',
  twitter: '#1A1A1A',
  instagram: '#E4405F',
  youtube: '#FF0000',
  tiktok: '#00BCD4',
  reddit: '#FF4500',
};

// Short labels sized for chart axes and compact KPI rows.
export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  twitter: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  reddit: 'Reddit',
};

// Stable platform order so every chart lists platforms the same way and ties
// break deterministically (mirrors ALL_PLATFORMS in the filters sheet).
export const PLATFORM_ORDER: SocialPlatform[] = [
  'facebook',
  'twitter',
  'instagram',
  'youtube',
  'tiktok',
  'reddit',
];

export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: MediaMeterColors.positive,
  neutral: MediaMeterColors.neutralSentiment,
  negative: MediaMeterColors.negative,
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

// Qualitative palette for entity tiles / categorical series — the design
// system's pastel set, cycled when there are more categories than colors.
export const SERIES_PALETTE = [
  MediaMeterColors.pastelLilac,
  MediaMeterColors.pastelMint,
  MediaMeterColors.pastelCoral,
  MediaMeterColors.pastelPink,
  MediaMeterColors.pastelCream,
  MediaMeterColors.pastelLime,
  '#8FB8F0',
  '#F0B38F',
] as const;

export function seriesColor(i: number): string {
  return SERIES_PALETTE[i % SERIES_PALETTE.length];
}

// Chart surface tokens, matching the web .db-card look.
//
// Theme-aware replacement for the former static object: call `useChartTokens()`
// inside a component and read the values inline (SVG fill/stroke props) or pass
// the result into a makeStyles factory. Values resolve to the active scheme's
// theme tokens so charts read correctly on both canvases:
//   • card/text/textSecondary        → the matching theme surface/text tokens
//   • border (axis frames / non-card lines) → t.borderCool (keeps the #E4E6EA
//     cool hairline in light, stays visible on dark). Card CONTAINER outlines
//     are handled per-role by consumers with t.cardBorder.
//   • axisText (faint axis labels)    → t.textTertiary
//   • gridline                        → the warm light hairline, or a low-alpha
//     white that reads on the dark canvas
//   • storyValue                      → the fixed lilac data series (legible on
//     dark, so intentionally not themed)
//   • totalResults                    → t.positive (green "Total Results" bars)
export function useChartTokens() {
  const t = useTheme();
  const { isDark } = useThemeMode();
  return {
    card: t.card,
    border: t.borderCool,
    gridline: isDark ? 'rgba(255, 255, 255, 0.08)' : '#EEECE8',
    axisText: t.textTertiary,
    text: t.text,
    textSecondary: t.textSecondary,
    storyValue: '#B9A4F7', // lilac line/area — "Total Story Value" in the web timeline
    totalResults: t.positive, // green bars — "Total Results" count
  };
}

export type ChartTokens = ReturnType<typeof useChartTokens>;

// Compact number format shared by axes, tiles, and legends (1.2K / 3.4M).
export function formatCompact(n: number): string {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

// Signed percentage for KPI deltas (+8% / -24%).
export function formatDelta(pct: number): string {
  const r = Math.round(pct);
  return `${r > 0 ? '+' : ''}${r}%`;
}
