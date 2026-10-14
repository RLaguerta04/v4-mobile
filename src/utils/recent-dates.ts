// Keeps the prototype's sample data feeling "live": at load time we shift every
// authored date forward so the newest item lands on today, preserving the
// relative spacing between items. The "x ago" labels are recomputed from the
// shifted dates. This is why the Home feed always has recent coverage and the
// default 7-day date filter has something to show, regardless of when the app
// is opened. Pure date utilities — no dependency on any dataset.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

// "Jul 24, 2026" → epoch ms (midnight local). Tolerant of trailing time text.
export function parseMDY(s: string): number {
  const m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return NaN;
  const mon = MONTHS.indexOf(m[1].slice(0, 3));
  return new Date(Number(m[3]), mon < 0 ? 0 : mon, Number(m[2])).getTime();
}

export function formatMDY(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ms to add so the newest authored date maps onto today (whole days).
export function dayShift(latestAuthoredMs: number, nowMs: number): number {
  return startOfDay(nowMs) - startOfDay(latestAuthoredMs);
}

// Replace the first "Mon D, YYYY" in a string with its shifted value, keeping
// the rest (e.g. the time in "Jul 27, 2026, 11:58 PM" or "… · 6:30 PM").
export function shiftDateString(s: string, shiftMs: number): string {
  return s.replace(/[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}/, (match) => formatMDY(parseMDY(match) + shiftMs));
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

// A deterministic "metrics as of" timestamp — a varied recent scrape time within
// the last ~18 hours (so posts look freshly, but staggeredly, refreshed), always
// clamped to be after the post (`earliestMs`) and not in the future. Seeded by a
// stable string (e.g. the post URL) so it doesn't jump between renders.
export function recentCapturedAt(seed: string, earliestMs: number, nowMs: number): number {
  const h = hashStr(seed);
  const WINDOW = 18 * 3_600_000; // 18h
  let ms = nowMs - (h % WINDOW);
  if (ms < earliestMs) {
    const span = Math.max(1, nowMs - earliestMs);
    ms = earliestMs + ((h >>> 3) % span);
  }
  return ms;
}

// Format a timestamp as the app's capturedAt string: "Oct 14, 2026, 2:12 AM".
export function formatCapturedAt(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${h}:${min} ${ampm}`;
}

// A human "x ago" label for a (shifted) date relative to now.
export function humanizeAgo(dateMs: number, nowMs: number): string {
  const days = Math.round((startOfDay(nowMs) - startOfDay(dateMs)) / DAY);
  if (days <= 0) {
    const hrs = Math.max(1, Math.floor((nowMs - startOfDay(dateMs)) / 3_600_000));
    return `${hrs}h ago`;
  }
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.max(1, Math.round(days / 30))} months ago`;
}
