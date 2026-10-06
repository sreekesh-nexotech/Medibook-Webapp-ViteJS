import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { dateRange } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import { StatCard } from '@/shared/ui/StatCard';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import type {
  ReportExportFormat,
  ReportParams,
  ReportQuery,
} from '@/features/reports/domain/entities/reports.entities';
import { useReportExportMutation } from '@/features/reports/application/queries/useReportExportMutation';
import { useReportQuery } from '@/features/reports/application/queries/useReportQuery';

import { CAT_ICON_CLASS, REPORT_PAGE_SIZE } from '../reports.data';
import type { ReportCatalogItem } from '../reports.design';

import { ReportDataTable } from './ReportDataTable';
import { ReportFilterBar } from './ReportFilterBar';
import { kpiTile } from './reportsFormat';
import { saveBlob } from './reportsDownload';

const EXPORT_FAILED = 'Could not export the report. Please try again.';
const REPORT_FAILED = 'The report could not be loaded. Please try again.';

/** Label of the file each format produces, for toasts. */
const FORMAT_LABEL: Readonly<Record<ReportExportFormat, string>> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
};

interface ReportViewProps {
  report: ReportCatalogItem;
}

/**
 * One report: header with exports, the filters its definition lists, the KPI
 * tiles and the paged table. Mounted per report (keyed by code), so filters,
 * sort and page start fresh whenever another report is picked.
 *
 * Everything shown is computed by the server over the filtered rows — KPIs
 * cover every filtered row, not just the visible page — and the exports
 * render exactly the same filtered, sorted rows.
 */
export function ReportView({ report }: ReportViewProps) {
  const { definition } = report;
  const [params, setParams] = useState<ReportParams>({});
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<never>();
  const exporter = useReportExportMutation();

  const departments = useDepartmentsQuery();
  const doctors = useDoctorsQuery();

  // An open-ended range is fine (the server treats it as "since" / "until");
  // only a reversed one is refused, here rather than as a 400.
  const rangeError = definition.filters
    .filter((f) => f.kind === 'date_range')
    .map((f) => {
      const from = params[f.params[0] ?? ''] ?? '';
      const to = params[f.params[1] ?? ''] ?? '';
      return from && to ? dateRange(from, to) : undefined;
    })
    .find((e) => e !== undefined);

  const serverSort = sort.key ? { key: sort.key, dir: sort.dir } : null;
  const query: ReportQuery | null = rangeError
    ? null
    : { code: report.code, params, page: page + 1, pageSize: REPORT_PAGE_SIZE, sort: serverSort };
  const result = useReportQuery(query);
  const data = result.data;

  const isFiltered = Object.values(params).some((v) => v !== '');

  /** Every filter change resets to page 1 — page 4 of a narrower list is a dead end. */
  const patch = (next: ReportParams): void => {
    setParams((p) => ({ ...p, ...next }));
    setPage(0);
  };

  const clearFilters = (): void => {
    setParams({});
    setPage(0);
  };

  const handleSort = (key: string): void => {
    onSort(key);
    setPage(0);
  };

  const runExport = (format: ReportExportFormat): void => {
    exporter.mutate(
      { code: report.code, params, sort: serverSort, format },
      {
        onSuccess: (out) => {
          if (out.kind === 'file') {
            saveBlob(out.file, out.filename);
            toast(`Exported the ${report.title.toLowerCase()} as ${FORMAT_LABEL[format]}`);
          } else {
            toast(
              `This export has ${out.rows.toLocaleString('en-IN')} rows — it is being prepared and the link will be emailed to you.`,
              'info',
            );
          }
        },
        onError: (failure) => toast(isFailure(failure) ? failure.message : EXPORT_FAILED, 'error'),
      },
    );
  };

  const total = data?.total ?? 0;
  const canExport = !rangeError && data !== undefined && total > 0;
  const exporting = exporter.isPending ? exporter.variables.format : null;

  const tableState: TableStateSpec | undefined = rangeError
    ? {
        kind: 'empty',
        icon: 'calendar-x',
        title: 'Fix the date range to see this report.',
        message: rangeError,
      }
    : result.isLoadingError && !data
      ? {
          kind: 'error',
          message: isFailure(result.error) ? result.error.message : REPORT_FAILED,
          onRetry: () => void result.refetch(),
        }
      : !data || result.isPlaceholderData
        ? { kind: 'loading', rows: REPORT_PAGE_SIZE }
        : total === 0
          ? {
              kind: 'empty',
              icon: report.icon,
              title: isFiltered
                ? 'No rows match your filters.'
                : `Nothing has been recorded for the ${report.title.toLowerCase()} yet.`,
              message: isFiltered
                ? 'Widen the date range or clear a filter.'
                : 'Rows appear here as appointments, payments and settlements are recorded.',
              actionLabel: isFiltered ? 'Clear filters' : undefined,
              onAction: isFiltered ? clearFilters : undefined,
            }
          : undefined;

  const notes = data?.notes ?? definition.notes;

  return (
    <div className="flex flex-col gap-5">
      {/* selected report + export */}
      <Card pad={18} className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            'flex size-11.5 flex-none items-center justify-center rounded-lg',
            CAT_ICON_CLASS[report.cat],
          )}
        >
          <Icon name={report.icon} size={22} />
        </div>
        <div className="min-w-45 flex-1">
          <SectionTitle size={18}>{report.title}</SectionTitle>
          <div className="text-caption text-text-muted mt-0.5">{report.brief}</div>
        </div>
        <span
          title={
            canExport
              ? `Export all ${total} ${report.noun} that match the filters`
              : 'There are no rows to export — widen the filters first'
          }
        >
          <Button
            variant="secondary"
            icon="download"
            onClick={() => runExport('csv')}
            busy={exporting === 'csv'}
            disabled={!canExport || exporter.isPending}
          >
            Export CSV
          </Button>
        </span>
        <Button
          icon="printer"
          onClick={() => runExport('pdf')}
          busy={exporting === 'pdf'}
          disabled={!canExport || exporter.isPending}
        >
          Save as PDF
        </Button>
      </Card>

      {/* filters — exactly the controls this report's definition lists */}
      <Card pad={16} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <RefreshBtn
            onRefresh={async () => {
              await result.refetch();
            }}
            title={`Refresh the ${report.title.toLowerCase()}`}
          />
          <ReportFilterBar
            filters={definition.filters}
            params={params}
            onChange={patch}
            departments={departments.data ?? []}
            doctors={doctors.data ?? []}
          />
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
            >
              Clear filters
            </button>
          )}
          <div className="flex-1" />
          {data && (
            <span className="text-caption text-text-muted">
              {total.toLocaleString('en-IN')} {report.noun}
            </span>
          )}
          {notes.length > 0 && <InfoDot text={notes.join(' ')} />}
        </div>
        {rangeError !== undefined && <span className="text-body text-d-500">{rangeError}</span>}
      </Card>

      {/* summary tiles — computed by the server over every filtered row */}
      {data && !rangeError ? (
        data.kpis.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((k) => (
              <StatCard key={k.key} k={kpiTile(k, report)} />
            ))}
          </div>
        )
      ) : result.isLoadingError || rangeError ? null : (
        <SkeletonKpiStrip count={3} />
      )}

      {/* the rows themselves */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SectionTitle>{report.title} rows</SectionTitle>
        </div>
        <ReportDataTable
          columns={data?.columns ?? definition.columns}
          rows={data?.rows ?? []}
          total={total}
          sort={sort}
          onSort={handleSort}
          page={page}
          onPage={setPage}
          noun={report.noun}
          state={tableState}
          scrollLabel={`${report.title} rows`}
        />
      </Card>
    </div>
  );
}
