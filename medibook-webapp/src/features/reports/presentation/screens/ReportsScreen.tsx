import { useMemo, useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { dateRange } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { StatCard } from '@/shared/ui/StatCard';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useAuditStore } from '@/features/audit/application/store/audit.store';
import {
  useCatalogDepartments,
  useCatalogDoctorNames,
} from '@/features/doctors/application/store/catalog.selectors';
import {
  ALL_DEPARTMENTS,
  ALL_DOCTORS,
  buildReportKpis,
  buildReportTable,
  EMPTY_FILTERS,
  filterAudit,
  filterFacts,
  filterOptions,
  filterSettlements,
  hasActiveFilters,
  type ReportContext,
  reportSortAccessors,
} from '@/features/reports/application/store/reports.logic';
import {
  FACTS_FROM,
  FACTS_TO,
  REPORT_FACTS,
} from '@/features/reports/application/store/reports.fixtures';
import type {
  ReportFilter,
  ReportFilterState,
  ReportTableRow,
} from '@/features/reports/application/store/reports.types';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';

import { ReportDataTable } from '../components/ReportDataTable';
import { ReportPickerCard } from '../components/ReportPickerCard';
import { CAT_ICON_CLASS, REPORT_CATS, REPORT_PAGE_SIZE, REPORTS } from '../reports.data';

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

/** How long the simulated re-derive shimmers before the rows come back. */
const REFRESH_MS = 420;

/**
 * Hospital Reports — audit HA-13 (§2.4): "Fourteen report screens exist, but
 * each shows four fixed tiles with no data table, and the filters change
 * nothing."
 *
 * One direction of data, and the tiles come last:
 *
 * ```
 * seed facts → filterFacts(the filters THIS report shows)
 *            → buildReportTable  (the table you see)
 *            → buildReportKpis   (the tiles above it)
 *            → downloadCsv       (the same rows, in the same order)
 * ```
 *
 * Because the tiles are derived from the filtered rows rather than hardcoded,
 * moving any filter visibly moves them — which is what proves the filters
 * work. Departments and doctors come from the hospital's own Doctors &
 * Departments catalogue, not a fixed list (audit 2.6.3).
 */
export function ReportsScreen() {
  const settlements = useSettlementsStore((s) => s.settlements);
  const auditEntries = useAuditStore((s) => s.entries);
  const { can } = usePermission();

  const [cat, setCat] = useState<string>('All');
  const [sel, setSel] = useState<string>(REPORTS[0].id);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const { sort, onSort, sorted } = useSort<ReportTableRow>();
  const { ref: printRef, print } = usePrintArea<HTMLDivElement>();

  const report = REPORTS.find((r) => r.id === sel) ?? REPORTS[0];
  const shown = report.filters;

  const catalogDepartments = useCatalogDepartments();
  const catalogDoctors = useCatalogDoctorNames(
    filters.dept === ALL_DEPARTMENTS ? undefined : filters.dept,
  );

  const options = useMemo(
    () =>
      filterOptions(report.id, REPORT_FACTS, auditEntries, {
        departments: catalogDepartments,
        doctors: catalogDoctors,
      }),
    [report.id, auditEntries, catalogDepartments, catalogDoctors],
  );

  const ctx = useMemo<ReportContext>(
    () => ({
      facts: filterFacts(REPORT_FACTS, shown, filters),
      settlements: filterSettlements(settlements, shown, filters),
      audit: filterAudit(auditEntries, shown, filters),
    }),
    [shown, filters, settlements, auditEntries],
  );

  /** The same report with no filters applied — the denominator of "n of N". */
  const totalRows = useMemo(
    () =>
      buildReportTable(report.id, {
        facts: REPORT_FACTS,
        settlements,
        audit: auditEntries,
      }).rows.length,
    [report.id, settlements, auditEntries],
  );

  const table = useMemo(() => buildReportTable(report.id, ctx), [report.id, ctx]);
  const kpis = useMemo(() => buildReportKpis(report.id, ctx), [report.id, ctx]);
  const accessors = useMemo(() => reportSortAccessors(table), [table]);

  const ordered = sorted([...table.rows], accessors);
  const pageCount = Math.max(1, Math.ceil(ordered.length / REPORT_PAGE_SIZE));
  const pg = Math.min(page, pageCount - 1);

  const isFiltered = hasActiveFilters(filters);
  const rangeError = dateRange(filters.from, filters.to);

  /** Every filter change resets to page 1 — page 4 of a narrower list is a dead end. */
  const patch = (next: Partial<ReportFilterState>): void => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(0);
  };

  /** Changing department invalidates a doctor who does not work in it. */
  const setDept = (dept: string): void => patch({ dept, doctor: ALL_DOCTORS });

  const clearFilters = (): void => {
    setFilters(EMPTY_FILTERS);
    setPage(0);
  };

  const selectReport = (id: string): void => {
    setSel(id);
    setPage(0);
  };

  const refresh = async (): Promise<void> => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
    setLoading(false);
  };

  const exportCsv = (): void => {
    downloadCsv(`medibook-${report.id}-report.csv`, [
      table.columns,
      ...ordered.map((row) => row.csv),
    ]);
    toast(`Exported ${ordered.length} ${table.noun} as CSV`, 'success');
  };

  const has = (name: ReportFilter): boolean => shown.includes(name);

  if (!can('Reports.view')) {
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

  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: REPORT_PAGE_SIZE }
    : ordered.length === 0
      ? {
          kind: 'empty',
          icon: report.icon,
          title: isFiltered
            ? 'No rows match your filters.'
            : `Nothing has been recorded for the ${report.name.toLowerCase()} yet.`,
          message: isFiltered
            ? `Widen the date range or clear a filter. The seeded data covers ${fmtDate(FACTS_FROM)} to ${fmtDate(FACTS_TO)}.`
            : 'Rows appear here as appointments, payments and settlements are recorded.',
          actionLabel: isFiltered ? 'Clear filters' : undefined,
          onAction: isFiltered ? clearFilters : undefined,
        }
      : undefined;

  const visibleReports = REPORTS.filter((r) => cat === 'All' || r.cat === cat);

  return (
    <div className="flex flex-col gap-5">
      <div ref={printRef} className="flex flex-col gap-5">
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
            <SectionTitle size={18}>{report.name}</SectionTitle>
            <div className="text-caption text-text-muted mt-0.5">
              {report.brief} {table.rowMeaning}
            </div>
          </div>
          <span
            title={
              ordered.length === 0
                ? 'There are no rows to export — widen the filters first'
                : `Export the ${ordered.length} ${table.noun} shown below`
            }
          >
            <Button
              variant="secondary"
              icon="download"
              onClick={exportCsv}
              disabled={ordered.length === 0}
            >
              Export CSV
            </Button>
          </span>
          <Button icon="printer" onClick={print}>
            Save as PDF
          </Button>
        </Card>

        {/* filters — exactly the controls this report's columns justify */}
        <Card pad={16} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refresh} title={`Refresh the ${report.name.toLowerCase()}`} />
            {has('date') && (
              <>
                <span className="text-body text-text-muted">From</span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) => patch({ from: e.target.value })}
                  aria-label="From date"
                  title="From date"
                  className={DATE_INPUT_CLASS}
                />
                <span className="text-body text-text-muted">to</span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => patch({ to: e.target.value })}
                  aria-label="To date"
                  title="To date"
                  className={DATE_INPUT_CLASS}
                />
              </>
            )}
            {has('dept') && (
              <FilterSelect
                value={filters.dept}
                options={options.departments}
                onChange={setDept}
                aria-label="Filter by department"
              />
            )}
            {has('doctor') && (
              <FilterSelect
                value={filters.doctor}
                options={options.doctors}
                onChange={(doctor) => patch({ doctor })}
                aria-label="Filter by doctor"
              />
            )}
            {has('status') && (
              <FilterSelect
                value={filters.status}
                options={options.statuses}
                onChange={(status) => patch({ status })}
                aria-label="Filter by status"
              />
            )}
            {has('mode') && (
              <FilterSelect
                value={filters.mode}
                options={options.modes}
                onChange={(mode) => patch({ mode })}
                aria-label="Filter by payment mode"
              />
            )}
            {has('source') && (
              <FilterSelect
                value={filters.source}
                options={options.sources}
                onChange={(source) => patch({ source })}
                aria-label="Filter by booking source"
              />
            )}
            {has('user') && (
              <FilterSelect
                value={filters.user}
                options={options.users}
                onChange={(user) => patch({ user })}
                aria-label="Filter by user"
              />
            )}
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
            <span className="text-caption text-text-muted">
              {ordered.length} of {totalRows} {table.noun}
            </span>
            <InfoDot text="The tiles below are calculated from the rows this filter set produces — change a filter and they move with the table. The CSV export writes exactly these rows." />
          </div>
          {rangeError !== undefined && <span className="text-body text-d-500">{rangeError}</span>}
        </Card>

        {/* summary tiles — derived from the filtered rows above */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <StatCard key={k.label} k={k} />
          ))}
        </div>

        {/* the rows themselves */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SectionTitle>{report.name} rows</SectionTitle>
            <div className="flex-1" />
            <span className="text-caption text-text-muted">
              Seeded data: {fmtDate(FACTS_FROM)} – {fmtDate(FACTS_TO)}
            </span>
          </div>
          <ReportDataTable
            table={table}
            rows={ordered}
            sort={sort}
            onSort={onSort}
            page={pg}
            onPage={setPage}
            state={tableState}
            scrollLabel={`${report.name} rows`}
          />
        </Card>
      </div>

      {/* report picker */}
      <Card pad={16} className="flex flex-wrap items-center justify-between gap-3">
        <SegTabs tabs={REPORT_CATS} value={cat} onChange={setCat} />
        <span className="text-caption text-text-muted">
          Choose a report — {visibleReports.length} of {REPORTS.length} shown
        </span>
      </Card>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {visibleReports.map((r) => (
          <ReportPickerCard
            key={r.id}
            report={r}
            selected={r.id === sel}
            onSelect={() => selectReport(r.id)}
          />
        ))}
      </div>
    </div>
  );
}
