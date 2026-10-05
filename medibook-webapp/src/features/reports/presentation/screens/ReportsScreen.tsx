import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { usePermission } from '@/shared/hooks/usePermission';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards, SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';

import { useReportCatalogQuery } from '@/features/reports/application/queries/useReportCatalogQuery';

import { ReportPickerCard } from '../components/ReportPickerCard';
import { ReportView } from '../components/ReportView';
import { REPORT_CATS } from '../reports.data';
import { toCatalogItem } from '../reports.design';

const ALL_CATEGORIES = 'All';

/**
 * Hospital Reports — audit HA-13 (§2.4): "Fourteen report screens exist, but
 * each shows four fixed tiles with no data table, and the filters change
 * nothing."
 *
 * Every report now comes from the hospital API: the catalogue
 * (`GET /hospital/reports`) lists each report with its filters and columns,
 * and the selected report (`GET /hospital/reports/{code}`) returns one page of
 * rows plus KPI tiles computed over all filtered rows. Filters, sorting and
 * paging are applied by the server, and the CSV / PDF exports render exactly
 * the same filtered rows. Department and doctor filters list the hospital's
 * own catalogue (H1).
 */
export function ReportsScreen() {
  const { can } = usePermission();
  const canView = can('Reports.view');
  const catalog = useReportCatalogQuery(canView);

  const [cat, setCat] = useState<string>(ALL_CATEGORIES);
  const [sel, setSel] = useState<string | null>(null);

  if (!canView) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to reports"
          message="Reporting is limited to roles with the Reports view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  if (catalog.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <SkeletonCards count={1} lines={2} />
        <SkeletonKpiStrip count={3} />
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  if (catalog.isError) {
    return (
      <ErrorState
        title="Reports didn't load"
        message={isFailure(catalog.error) ? catalog.error.message : undefined}
        onRetry={() => void catalog.refetch()}
      />
    );
  }

  const items = catalog.data.map(toCatalogItem);
  const selected = items.find((r) => r.code === sel) ?? items[0];

  if (!selected) {
    return (
      <Card>
        <EmptyState
          icon="file-text"
          title="No reports are available yet."
          message="Reports appear here once they are enabled for your hospital."
        />
      </Card>
    );
  }

  const visible = items.filter((r) => cat === ALL_CATEGORIES || r.cat === cat);

  return (
    <div className="flex flex-col gap-5">
      <ReportView key={selected.code} report={selected} />

      {/* report picker */}
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <SegTabs tabs={REPORT_CATS} value={cat} onChange={setCat} />
        <span className="text-caption text-text-muted">
          Choose a report — {visible.length} of {items.length} shown
        </span>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => (
          <ReportPickerCard
            key={r.code}
            report={r}
            selected={r.code === selected.code}
            onSelect={() => setSel(r.code)}
          />
        ))}
      </div>
    </div>
  );
}
