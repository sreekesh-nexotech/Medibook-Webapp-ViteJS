/**
 * Pure formatting + date helpers ported 1:1 from the design file
 * (`data.jsx` / `Ops.jsx`). No React, no stores — safe everywhere.
 */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "₹ 1,02,400" (en-IN grouping); em dash for missing values. */
export function money(n: number | null | undefined): string {
  if (n == null) return '—';
  return '₹ ' + Number(n).toLocaleString('en-IN');
}

/** Compact rupee figures for KPI tiles: "₹ 2.6L", "₹ 9.8K". */
export function moneyShort(n: number): string {
  if (n >= 100000) return '₹ ' + (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + 'L';
  if (n >= 1000) return '₹ ' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
  return '₹ ' + n;
}

/** "2026-06-20" -> "20 Jun 2026"; em dash for missing values. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/**
 * Local calendar date as `yyyy-mm-dd`.
 *
 * Assembled from the local date parts on purpose. `toISOString()` converts to
 * UTC first, so in any zone ahead of UTC a local-midnight Date serialises to
 * the PREVIOUS day — in IST (this product's market) `relToISO('Today')` used to
 * return yesterday, which is what made new appointments land on yesterday,
 * disappear from the default Today view, and take a walk-in token that never
 * reached a queue. Never reintroduce `toISOString()` here.
 */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's local calendar date as `yyyy-mm-dd`. */
export function todayISO(): string {
  return toLocalISO(new Date());
}

/** `yyyy-mm-dd` shifted by whole days, staying on the local calendar. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

/** Whole days from today to `iso` (negative = past), on the local calendar. */
export function daysFromTodayISO(iso: string): number {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/** True when `iso` is before today (local calendar). */
export function isPastISO(iso: string): boolean {
  return daysFromTodayISO(iso) < 0;
}

/**
 * ISO date -> the relative labels the hospital seed uses ("Today", "Tomorrow",
 * "14 Jun").
 *
 * The month abbreviation comes from the pinned `MONTHS_SHORT` array, not from
 * `toLocaleDateString`. ICU's en-IN short month is inconsistent in width — it
 * yields "Sept" for September but "Jun" for June — so a locale-formatted label
 * silently stopped matching `fmtDate`'s output (and the seed's) every
 * September, and exact-date filters comparing the two never matched.
 */
export function isoToRel(iso: string): string {
  const diff = daysFromTodayISO(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;
}

/**
 * Relative label -> ISO date. Understands "Today", "Tomorrow" and the seed's
 * "14 Jun" / "14 Jun 2026" day-month labels; anything unrecognised falls back
 * to today.
 *
 * A bare day-month label carries no year, so it resolves against the current
 * year and then rolls forward when that would put it more than six months in
 * the past — which keeps the seed's near-future labels in the future across a
 * year boundary instead of silently collapsing them to today.
 */
export function relToISO(rel: string): string {
  const label = rel.trim();
  if (label === 'Tomorrow') return addDaysISO(todayISO(), 1);
  if (label === 'Today' || label === '') return todayISO();

  const m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?(?:\s+(\d{4}))?$/.exec(label);
  if (m) {
    const day = Number(m[1]);
    const prefix = m[2].slice(0, 3).toLowerCase();
    const month = MONTHS_SHORT.findIndex((x) => x.toLowerCase() === prefix);
    if (month >= 0) {
      const now = new Date();
      const year = m[3] ? Number(m[3]) : now.getFullYear();
      let d = new Date(year, month, day);
      if (!m[3] && daysFromTodayISO(toLocalISO(d)) < -183) {
        d = new Date(year + 1, month, day);
      }
      return toLocalISO(d);
    }
  }

  // Already an ISO date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;

  return todayISO();
}

/** "8:30 am" -> minutes since midnight, for time-column sorting. */
export function timeToMinutes(t: string | null | undefined): number {
  const m = /(\d+):(\d+)\s*(am|pm)/i.exec(t ?? '');
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

/** "June 13, 2026 · 09:42" -> timestamp (date part only), for log sorting. */
export function opsTime(s: string): number {
  return Date.parse(String(s).split('·')[0].trim()) || 0;
}

/** Hospital-wide running token: 7 -> "T-007". */
export function formatToken(seq: number): string {
  return 'T-' + String(seq).padStart(3, '0');
}
