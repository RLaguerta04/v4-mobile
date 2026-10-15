// Shared clip helpers for the decorative radio players (feed-card mini-player +
// detail hero). There's no real audio — this just turns an authored "m:ss"
// length into seconds and back, for the simulated-playback time counter.

// "2:05" → 125 seconds. Falls back to a sensible length when absent/unparseable.
export function parseLength(length?: string): number {
  if (!length) return 165;
  const m = /(\d+):(\d{1,2})/.exec(length);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseInt(length, 10);
  return Number.isFinite(n) && n > 0 ? n : 165;
}

// Seconds → "m:ss".
export function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
