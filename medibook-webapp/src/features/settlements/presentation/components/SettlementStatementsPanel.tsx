import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { dateRange } from '@/shared/lib/validate';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { useStatementsQuery } from '@/features/settlements/application/queries/useStatementsQuery';
import type { StatementSortField } from '@/features/settlements/domain/entities/settlements.entities';
import { StatementDownloadButton } from '@/features/settlements/presentation/components/StatementDownloadButton';
import {
  effectiveRate,
  fmtDateTime,
  rupees,
  statementSpan,
} from '@/features/settlements/presentation/components/settlementsFormat';

const PAGE_SIZE = 12;

const COLUMNS = [
  'Statement',
  'Month',
  'Issued',
  'Bookings',
  'Gross',
  'Commission incl. GST',
  'Net payable',
  'PDF',
] as const;

const SORT_KEYS: Readonly<Record<string, StatementSortField>> = {
  Month: 'period_start',
  Issued: 'issued_at',
};

/**
 * Statements tab (UAT-29, appendix 09 R1) — the monthly statements Medibook
 * issues (`GET /hospital/statements`, Q99), newest month first, each with
 * its PDF. Statements cover calendar months while settlement periods are
 * custom windows, so this is where a month's statement is found whatever
 * periods it spans. Range, sort and paging run on the server.
 */
export function SettlementStatementsPanel() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<never>({ key: 'period_start', dir: 'desc' });

  const rangeError = from !== '' && to !== '' ? dateRange(from, to) : undefined;
  const sortField: StatementSortField = sort.key === 'issued_at' ? 'issued_at' : 'period_start';
  const query = useStatementsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    dateFrom: rangeError ? undefined : from || undefined,
    dateTo: rangeError ? undefined : to || undefined,
    sortField,
    sortDirection: sort.dir,
  });
  const rows = query.data?.items ?? [];
  const filtersActive = from !== '' || to !== '';

  const setDate =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const clearDates = (): void => {
    setFrom('');
    setTo('');
    setPage(0);
  };

  let state: TableStateSpec | undefined;
  if (query.isPending) state = { kind: 'loading', rows: 4 };
  else if (query.isError)
    state = {
      kind: 'error',
      message: isFailure(query.error) ? query.error.message : undefined,
      onRetry: () => void query.refetch(),
    };
  else if (rows.length === 0)
    state = {
      kind: 'empty',
      icon: 'file-text',
      title: filtersActive ? 'No statements in this range.' : 'No statements yet.',
      message: filtersActive
        ? 'Widen the date range or clear it.'
        : 'Medibook issues a statement after each month with online bookings.',
      actionLabel: filtersActive ? 'Clear dates' : undefined,
      onAction: filtersActive ? clearDates : undefined,
    };

  return (
    <>
      <Card pad={16} className="flex flex-wrap items-center gap-3.5">
        <span className="text-body text-text-muted">Months between</span>
        <input
          type="date"
          value={from}
          aria-label="Statements for months ending on or after"
          aria-invalid={rangeError ? true : undefined}
          onChange={(e) => setDate(setFrom)(e.target.value)}
          className="border-border text-body text-text-body h-11 rounded-md border px-3.5"
        />
        <span className="text-body text-text-muted">and</span>
        <input
          type="date"
          value={to}
          aria-label="Statements for months starting on or before"
          aria-invalid={rangeError ? true : undefined}
          onChange={(e) => setDate(setTo)(e.target.value)}
          className="border-border text-body text-text-body h-11 rounded-md border px-3.5"
        />
        {filtersActive && <ClearChip label="Clear dates" onClick={clearDates} />}
        {rangeError && (
          <span className="text-caption text-d-700 inline-flex items-center gap-1.5">
            <Icon name="triangle-alert" size={13} /> {rangeError}
          </span>
        )}
        <span className="flex-1" />
        <div className="text-caption text-text-muted flex items-center gap-1.75">
          <InfoDot text="A statement covers one calendar month of online bookings: gross collected, refunds, gateway fees, Medibook's commission and convenience fees with their GST, and the net payable. Settlement periods can be shorter or cross months, so a period may appear in two statements." />{' '}
          One statement per month
        </div>
      </Card>
      <Card pad={20}>
        <SectionTitle size={16} className="mb-4">
          Monthly Statements
        </SectionTitle>
        <TableShell
          columns={COLUMNS}
          rightCols={['Bookings', 'Gross', 'Commission incl. GST', 'Net payable']}
          sortKeys={SORT_KEYS}
          sort={sort}
          onSort={(key) => {
            onSort(key);
            setPage(0);
          }}
          state={state}
          scrollLabel="Monthly statements"
        >
          {rows.map((st) => {
            const commission = st.commissionPaise + st.commissionGstPaise;
            return (
              <tr key={st.id} className="hover:bg-grey-200 transition-colors duration-150">
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{st.statementNo}</td>
                <td className={tdClass}>{statementSpan(st)}</td>
                <td className={tdClass}>{fmtDateTime(st.issuedAt)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>
                  {st.bookingsCount.toLocaleString('en-IN')}
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{rupees(st.grossPaise)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>
                  {rupees(commission)}
                  <div className="text-caption text-text-muted">
                    {effectiveRate(commission, st.grossPaise)} of gross
                  </div>
                </td>
                <td
                  className={cn(tdClass, 'text-text-strong text-right font-semibold tabular-nums')}
                >
                  {rupees(st.netPayablePaise)}
                </td>
                <td className={tdClass}>
                  <StatementDownloadButton
                    statementId={st.id}
                    statementNo={st.statementNo}
                    pdfFileId={st.pdfFileId}
                    size="sm"
                  >
                    Download
                  </StatementDownloadButton>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager
          total={query.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="statements"
        />
      </Card>
    </>
  );
}
