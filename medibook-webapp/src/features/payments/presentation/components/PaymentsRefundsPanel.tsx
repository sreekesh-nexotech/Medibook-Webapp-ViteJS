import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Pager } from '@/shared/ui/Pager';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type {
  PaymentMethod,
  RefundListQuery,
  RefundStatus,
} from '@/features/payments/domain/entities/payments.entities';
import { useRefundPageQuery } from '@/features/payments/application/queries/useRefundPageQuery';
import {
  REFUND_STATUS_BADGE,
  dateTimeCopy,
  type DateRange,
} from '@/features/payments/presentation/components/payments.view';

const PAGE_SIZE = 9;

const COLUMNS = ['Asked', 'Booking', 'Method', 'Amount', 'Status', 'Reason'] as const;

const ANY_STATUS = 'All refund states';

/** Status filter options → the refund statuses each asks the server for. */
const STATUS_FILTER: Readonly<Record<string, readonly RefundStatus[]>> = {
  'In progress': ['requested', 'processing'],
  Refunded: ['processed'],
  Failed: ['failed'],
};

interface PaymentsRefundsPanelProps {
  range: DateRange;
  method: PaymentMethod | null;
  /** The screen's search, applied to the booking reference on this page. */
  search: string;
}

/**
 * The Refunds tab (appendix 04 R2, F4): refunds by the day they were asked
 * for — desk and online — so a refund made today of an older payment shows
 * today, and requested, processing and failed refunds are all visible with
 * the gateway's failure reason.
 */
export function PaymentsRefundsPanel({ range, method, search }: PaymentsRefundsPanelProps) {
  const [statusLabel, setStatusLabel] = useState(ANY_STATUS);
  const [page, setPage] = useState(0);
  const query: RefundListQuery = {
    ...range,
    statuses: STATUS_FILTER[statusLabel] ?? [],
    method,
    page: page + 1,
    pageSize: PAGE_SIZE,
  };
  const refunds = useRefundPageQuery(query, true);
  const needle = search.trim().toLowerCase();
  // The refunds list has no text search; the box narrows this page by booking.
  const rows = (refunds.data?.items ?? []).filter(
    (r) => needle === '' || (r.bookingRef ?? '').toLowerCase().includes(needle),
  );

  const state: TableStateSpec | undefined = refunds.isPending
    ? { kind: 'loading', rows: PAGE_SIZE }
    : refunds.isError
      ? {
          kind: 'error',
          message: isFailure(refunds.error) ? refunds.error.message : undefined,
          onRetry: () => void refunds.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'undo-2',
            title: 'No refunds in this window.',
            message: 'Refunds appear here on the day they are asked for, desk and online.',
          }
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={statusLabel}
          options={[ANY_STATUS, ...Object.keys(STATUS_FILTER)]}
          onChange={(v) => {
            setStatusLabel(v);
            setPage(0);
          }}
          aria-label="Filter refunds by state"
        />
        {needle !== '' && (
          <span className="text-caption text-text-muted">
            Search narrows this page by booking reference.
          </span>
        )}
      </div>
      <TableShell columns={COLUMNS} rightCols={['Amount']} state={state} scrollLabel="Refunds">
        {rows.map((r) => {
          const badge = REFUND_STATUS_BADGE[r.status];
          return (
            <tr key={r.id}>
              <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                {dateTimeCopy(r.requestedAt)}
              </td>
              <td className={tdClass}>{r.bookingRef ?? '—'}</td>
              <td className={tdClass}>{r.method.toUpperCase()}</td>
              <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                {money(r.amountRupees)}
              </td>
              <td className={tdClass}>
                <div className="flex flex-col items-start gap-0.75">
                  <Badge status={badge.status}>{badge.label}</Badge>
                  {r.failureReason && (
                    <span className="text-caption text-d-700">{r.failureReason}</span>
                  )}
                  {r.processedAt && (
                    <span className="text-caption text-text-muted">
                      {dateTimeCopy(r.processedAt)}
                    </span>
                  )}
                </div>
              </td>
              <td className={cn(tdClass, 'max-w-70')}>
                <span className="text-text-muted">{r.reason}</span>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={refunds.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="refunds"
      />
    </div>
  );
}
