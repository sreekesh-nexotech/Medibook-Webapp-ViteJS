import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { useOpsReportsQuery } from '@/features/ops-reports/application/queries/useOpsReportsQuery';
import { OpsReportCard } from '@/features/ops-reports/presentation/components/OpsReportCard';
import { OpsReportSchedulesCard } from '@/features/ops-reports/presentation/components/OpsReportSchedulesCard';
import { OpsReportView } from '@/features/ops-reports/presentation/components/OpsReportView';

/** Placeholder cards while the catalogue loads — two rows of the 3-up grid. */
const SKELETON_CARD_COUNT = 6;
const SKELETON_CARD_LINES = 4;

const REPORTS_TAB = 'Reports';
const SCHEDULES_TAB = 'Scheduled emails';

/**
 * Ops platform reports (UAT-36): the catalogue the backend registers
 * (`GET /platform/reports`), each report opened with its sheet filters, a
 * preview run and CSV / Excel / PDF exports; and, for roles with
 * `reports.edit`, the scheduled report emails.
 */
export function OpsReportsScreen() {
  const reports = useOpsReportsQuery();
  // The schedules API needs reports.edit even to read (backend rule).
  const canSchedule = useOpsPermission().can('reports.edit');
  const [tab, setTab] = useState(REPORTS_TAB);
  const [openCode, setOpenCode] = useState<string | null>(null);

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

  const open = reports.data.find((r) => r.code === openCode) ?? null;
  if (open) return <OpsReportView key={open.code} report={open} onBack={() => setOpenCode(null)} />;

  return (
    <div className="flex flex-col gap-5">
      {canSchedule && (
        <Card pad={16} className="flex items-center gap-3">
          <SegTabs tabs={[REPORTS_TAB, SCHEDULES_TAB]} value={tab} onChange={setTab} />
        </Card>
      )}
      {tab === SCHEDULES_TAB && canSchedule ? (
        <OpsReportSchedulesCard reports={reports.data} />
      ) : reports.data.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No reports available."
          message="No platform reports are registered yet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.data.map((r) => (
            <OpsReportCard key={r.code} report={r} onOpen={setOpenCode} />
          ))}
        </div>
      )}
    </div>
  );
}
