import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useExportOpsReportMutation } from '@/features/ops-reports/application/queries/useExportOpsReportMutation';
import { useOpsReportRunQuery } from '@/features/ops-reports/application/queries/useOpsReportRunQuery';
import type {
  OpsReportFormat,
  OpsReportParams,
  OpsReportRunQuery,
  OpsReportSummary,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { OpsReportFilterBar } from '@/features/ops-reports/presentation/components/OpsReportFilterBar';
import {
  OpsQueuedExportPanel,
  type QueuedExport,
} from '@/features/ops-reports/presentation/components/OpsQueuedExportPanel';
import {
  describeParams,
  fieldErrorLine,
  formatReportValue,
  isNumericKind,
  validateReportParams,
} from '@/features/ops-reports/presentation/components/opsReportsFormat';

/** Rows per preview page (the backend allows up to 100). */
const PREVIEW_PAGE_SIZE = 25;

const FORMAT_LABEL: Readonly<Record<OpsReportFormat, string>> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
};

interface OpsReportViewProps {
  report: OpsReportSummary;
  onBack: () => void;
}

/** Pull a run/export failure's message apart: the field errors (e.g. B7's span limit) first. */
function failureText(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const fields = fieldErrorLine(error.fieldErrors);
  return fields || error.message;
}

/**
 * One platform report (UAT-36): the binding sheet's filters, a run that
 * shows the KPIs and a sorted, paged preview (`GET /platform/reports/{code}`),
 * and CSV / Excel / PDF exports with the same filters. A large export is
 * queued on the server and polled here until it can be downloaded.
 */
export function OpsReportView({ report, onBack }: OpsReportViewProps) {
  const [params, setParams] = useState<OpsReportParams>({});
  const [applied, setApplied] = useState<OpsReportParams | null>(null);
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [queued, setQueued] = useState<readonly QueuedExport[]>([]);
  const { sort, onSort } = useSort<never>();
  const exportReport = useExportOpsReportMutation();

  const runQuery: OpsReportRunQuery | null = applied
    ? {
        code: report.code,
        params: applied,
        page: page + 1,
        pageSize: PREVIEW_PAGE_SIZE,
        ...(sort.key ? { sort: sort.dir === 'desc' ? `-${sort.key}` : sort.key } : {}),
      }
    : null;
  const run = useOpsReportRunQuery(runQuery);
  const dirty = applied !== null && JSON.stringify(applied) !== JSON.stringify(params);

  const onChange = (patch: OpsReportParams): void => {
    setParams((p) => ({ ...p, ...patch }));
    setErrors({});
  };

  const check = (): boolean => {
    const e = validateReportParams(report.filters, params);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRun = (): void => {
    if (!check()) return;
    setPage(0);
    setApplied(params);
  };

  const handleExport = (format: OpsReportFormat): void => {
    if (!check()) return;
    exportReport.mutate(
      { code: report.code, format, params },
      {
        onSuccess: (result) => {
          if (result.status === 'file') {
            toast(`Exported ${report.title} (${FORMAT_LABEL[format]}).`, 'success');
            return;
          }
          setQueued((q) => [
            {
              exportId: result.exportId,
              title: report.title,
              format,
              rows: result.rows,
              startedAt: Date.now(),
            },
            ...q.filter((x) => x.exportId !== result.exportId),
          ]);
          toast(
            `${report.title} has ${result.rows.toLocaleString('en-IN')} rows — it is being prepared below and will also be emailed to you.`,
            'info',
          );
        },
        onError: (error) =>
          toast(failureText(error, 'The export failed. Please try again.'), 'error'),
      },
    );
  };

  const result = run.data;
  const columns = result?.columns ?? report.columns;
  const kpis: readonly StatCardData[] = (result?.kpis ?? []).map((k) => ({
    icon:
      k.kind === 'paise'
        ? 'indian-rupee'
        : k.kind === 'percent' || k.kind === 'bp'
          ? 'percent'
          : 'file-text',
    label: k.label,
    value: formatReportValue(k.value, k.kind),
    sub: 'Across every filtered row',
    iconClass: 'bg-blue-soft-bg text-text-navy',
    valueClass: 'text-text-strong',
    subClass: 'text-text-muted',
  }));

  const tableState: TableStateSpec | undefined = !applied
    ? {
        kind: 'empty',
        icon: 'file-text',
        title: 'Set the filters, then run the report.',
        message: 'The preview shows the KPIs and the first rows; exports use the same filters.',
      }
    : run.isPending
      ? { kind: 'loading', rows: 8 }
      : run.isError
        ? {
            kind: 'error',
            title: "The report didn't run",
            message: failureText(run.error, 'Please try again.'),
            onRetry: () => void run.refetch(),
          }
        : result && result.rows.length === 0
          ? {
              kind: 'empty',
              icon: 'file-text',
              title: 'No rows match these filters.',
              message: 'Widen the date range or clear a filter.',
            }
          : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" icon="arrow-left" onClick={onBack}>
            All reports
          </Button>
          <SectionTitle size={18}>{report.title}</SectionTitle>
          {report.notes.length > 0 && <InfoDot text={report.notes.join(' ')} />}
          <div className="flex-1"></div>
          {report.formats.map((fmt) => (
            <Button
              key={fmt}
              size="sm"
              variant="secondary"
              icon="download"
              busy={exportReport.isPending && exportReport.variables.format === fmt}
              disabled={exportReport.isPending}
              onClick={() => handleExport(fmt)}
            >
              {FORMAT_LABEL[fmt]}
            </Button>
          ))}
        </div>
        <OpsReportFilterBar
          filters={report.filters}
          params={params}
          onChange={onChange}
          errors={errors}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            icon="play"
            busy={run.isFetching && applied !== null}
            onClick={handleRun}
          >
            {applied ? 'Run again' : 'Run report'}
          </Button>
          <span className={cn('text-caption', dirty ? 'text-y-600' : 'text-text-muted')}>
            {dirty
              ? 'Filters changed — run again to update the preview.'
              : applied
                ? describeParams(report.filters, applied)
                : 'Dates are IST. Exports always use the filters shown above.'}
          </span>
        </div>
      </Card>

      {queued.map((q) => (
        <OpsQueuedExportPanel
          key={q.exportId}
          queued={q}
          onDismiss={() => setQueued((list) => list.filter((x) => x.exportId !== q.exportId))}
        />
      ))}

      {kpis.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {kpis.map((k) => (
            <StatCard key={k.label} k={k} />
          ))}
        </div>
      )}

      <Card>
        <TableShell
          columns={columns.map((c) => c.label)}
          rightCols={columns.filter((c) => isNumericKind(c.kind)).map((c) => c.label)}
          sortKeys={Object.fromEntries(columns.map((c) => [c.label, c.key]))}
          sort={sort}
          onSort={(key) => {
            onSort(key);
            setPage(0);
          }}
          state={tableState}
          scrollLabel={`${report.title} preview`}
        >
          {(result?.rows ?? []).map((row, i) => (
            // Report rows carry no id; position within this page is their identity.
            <tr key={`${page}-${i}`}>
              {columns.map((c, ci) => (
                <td
                  key={c.key}
                  className={cn(
                    tdClass,
                    isNumericKind(c.kind) && 'text-right tabular-nums',
                    ci === 0 && 'text-text-strong font-medium',
                  )}
                >
                  {formatReportValue(row[c.key] ?? null, c.kind)}
                </td>
              ))}
            </tr>
          ))}
        </TableShell>
        {result && (
          <Pager
            total={result.total}
            page={page}
            pageSize={PREVIEW_PAGE_SIZE}
            onPage={setPage}
            noun="rows"
          />
        )}
      </Card>
    </div>
  );
}
