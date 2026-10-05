import { isFailure } from '@/core/error/failure';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { useOpsReportsQuery } from '@/features/ops-reports/application/queries/useOpsReportsQuery';
import { OpsReportCard } from '@/features/ops-reports/presentation/components/OpsReportCard';

/** Placeholder cards while the catalogue loads — two rows of the 3-up grid. */
const SKELETON_CARD_COUNT = 6;
const SKELETON_CARD_LINES = 4;

/**
 * Ops platform reports — a 3-column grid of exportable-report cards (design
 * `OpsReports`), one per report the backend registers
 * (`GET /platform/reports`). Each card downloads the real CSV from
 * `GET /platform/reports/{code}/export.csv`.
 */
export function OpsReportsScreen() {
  const reports = useOpsReportsQuery();

  if (reports.isPending) {
    return (
      <SkeletonCards
        count={SKELETON_CARD_COUNT}
        lines={SKELETON_CARD_LINES}
        className="grid grid-cols-3"
      />
    );
  }

  if (reports.isError) {
    return (
      <ErrorState
        title="Reports didn't load"
        message={isFailure(reports.error) ? reports.error.message : undefined}
        onRetry={() => void reports.refetch()}
      />
    );
  }

  if (reports.data.length === 0) {
    return (
      <EmptyState
        icon="file-text"
        title="No reports available."
        message="No platform reports are registered yet."
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {reports.data.map((r) => (
        <OpsReportCard key={r.code} report={r} />
      ))}
    </div>
  );
}
