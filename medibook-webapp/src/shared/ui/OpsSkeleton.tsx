import { SkeletonKpiStrip, SkeletonTable, SkeletonToolbar } from '@/shared/ui/Skeleton';

/** The exact column rhythm of the ops list tables (design `OpsSkeleton`). */
const OPS_TABLE_COL_WIDTHS = ['26%', '14%', '14%', '12%', '12%', '8%'] as const;

/**
 * Ops screen-load skeleton: KPI cards + toolbar + table shimmer.
 *
 * Re-implemented on the shared `Skeleton` primitives so the ops console and
 * the hospital app share one shimmer, with the same public API and the same
 * pixels as before (audit 3.2/4.3).
 */
export function OpsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <SkeletonKpiStrip count={4} />
      <SkeletonToolbar controls={[300, 150]} action={170} />
      <SkeletonTable rows={5} colWidths={OPS_TABLE_COL_WIDTHS} />
    </div>
  );
}
