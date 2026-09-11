import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';

/**
 * Skeleton primitives — the hospital app's half of audit 3.2 / 4.3 ("the ops
 * console has one skeleton, the hospital app has nothing"). One shimmer look
 * for the whole product, built from the existing `--animate-skeleton-pulse`
 * token, so a loading screen never has to be hand-drawn again.
 *
 * Pick by shape, not by screen:
 *   `SkeletonLine`      one line of text
 *   `SkeletonBlock`     any rectangle (avatar, thumbnail, control)
 *   `SkeletonToolbar`   a filter/search toolbar card
 *   `SkeletonCards`     a row of equal cards
 *   `SkeletonKpiStrip`  the dashboards' KPI tile row
 *   `SkeletonTable`     a table: header strip + shimmer rows
 *
 * `OpsSkeleton` is now composed from these, so the ops console and the
 * hospital app shimmer identically.
 */

interface SkeletonBlockProps {
  /** Width in px or a % / CSS length string — per-block geometry, hence style. */
  w?: number | string;
  /** Height in px. */
  h?: number;
  className?: string;
}

/** A single shimmer rectangle — the atom every other primitive is built from. */
export function SkeletonBlock({ w = '100%', h = 12, className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-skeleton-pulse bg-grey-300 rounded-skeleton', className)}
      style={{ width: w, height: h }}
    />
  );
}

interface SkeletonLineProps {
  /** Width in px or a % string. Default `100%`. */
  w?: number | string;
  /** Height in px. Default 12 — one line of body text. */
  h?: number;
  className?: string;
}

/** One shimmer text line. */
export function SkeletonLine({ w = '100%', h = 12, className }: SkeletonLineProps) {
  return <SkeletonBlock w={w} h={h} className={className} />;
}

interface SkeletonCardsProps {
  /** How many cards to shimmer. */
  count?: number;
  /** Lines of shimmer text inside each card. */
  lines?: number;
  /** Card padding in px (matches `Card pad`). */
  pad?: number;
  className?: string;
}

/** A row of equal placeholder cards (list tiles, plan cards, doctor cards). */
export function SkeletonCards({ count = 3, lines = 3, pad = 18, className }: SkeletonCardsProps) {
  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} pad={pad} className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            {Array.from({ length: lines }, (_, l) => (
              <SkeletonLine key={l} w={l === 0 ? '42%' : l === 1 ? '58%' : '66%'} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

interface SkeletonKpiStripProps {
  /** How many KPI tiles the real strip will show. */
  count?: number;
  className?: string;
}

/** The dashboards' KPI tile row: label line, stat line, caption line per tile. */
export function SkeletonKpiStrip({ count = 4, className }: SkeletonKpiStripProps) {
  return (
    <div className={cn('flex gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} pad={18} className="min-w-0 flex-1">
          <div className="flex flex-col gap-3">
            <SkeletonBlock w="42%" h={12} />
            <SkeletonBlock w="58%" h={26} />
            <SkeletonBlock w="66%" h={10} />
          </div>
        </Card>
      ))}
    </div>
  );
}

interface SkeletonToolbarProps {
  /** Control widths in px, laid out left-to-right. */
  controls?: readonly number[];
  /** Control width in px pushed to the right of the toolbar (the action button). */
  action?: number;
  className?: string;
}

/** A search + filters toolbar card, with the primary action pushed right. */
export function SkeletonToolbar({
  controls = [300, 150],
  action = 170,
  className,
}: SkeletonToolbarProps) {
  return (
    <Card pad={16} className={cn('flex items-center gap-3', className)}>
      {controls.map((w, i) => (
        <SkeletonBlock key={i} w={w} h={42} />
      ))}
      <div className="flex-1" />
      {action > 0 && <SkeletonBlock w={action} h={42} />}
    </Card>
  );
}

interface SkeletonTableProps {
  /** Shimmer rows to draw. */
  rows?: number;
  /** Columns per row (ignored when `colWidths` is given). */
  cols?: number;
  /**
   * Exact per-column widths (px or % strings). Use this to mirror a real
   * table's column rhythm; otherwise columns are evenly spaced.
   */
  colWidths?: readonly (number | string)[];
  /** Wrap in a `Card` (default) — set false to drop a bare table into one. */
  card?: boolean;
  className?: string;
}

/** A table placeholder: the tinted header strip plus `rows` shimmer rows. */
export function SkeletonTable({
  rows = 5,
  cols = 6,
  colWidths,
  card = true,
  className,
}: SkeletonTableProps) {
  const widths =
    colWidths ?? Array.from({ length: Math.max(1, cols) }, () => `${Math.floor(88 / cols)}%`);
  const body = (
    <>
      <div className="bg-bg-tint mb-3 h-11 rounded-md opacity-60" />
      <div className="flex flex-col gap-3.5">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4">
            {widths.map((w, c) => (
              <SkeletonBlock key={c} w={w} h={c === 0 ? 14 : 12} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
  if (!card) return <div className={className}>{body}</div>;
  return <Card className={className}>{body}</Card>;
}
