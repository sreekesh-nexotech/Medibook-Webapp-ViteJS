import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { usePayoutsQuery } from '@/features/settlements/application/queries/usePayoutsQuery';
import type {
  Payout,
  PayoutSortField,
  PayoutStatus,
} from '@/features/settlements/domain/entities/settlements.entities';
import type { PeriodRef } from '@/features/settlements/presentation/components/SettlementPeriodDrawer';
import {
  fmtDateTime,
  PAYOUT_STATUS,
  periodLabel,
  rupees,
} from '@/features/settlements/presentation/components/settlementsFormat';

const PAGE_SIZE = 12;

const ALL_STATUSES = 'All statuses';

/** Filter label → server status; the labels are the badges the rows show. */
const STATUS_FILTER: Readonly<Record<string, PayoutStatus>> = {
  [PAYOUT_STATUS.pending.label]: 'pending',
  [PAYOUT_STATUS.released.label]: 'released',
  [PAYOUT_STATUS.on_hold.label]: 'on_hold',
  [PAYOUT_STATUS.failed.label]: 'failed',
};
const STATUS_OPTIONS = [ALL_STATUSES, ...Object.keys(STATUS_FILTER)];

const COLUMNS = [
  'Settlement Period',
  'Amount',
  'Status',
  'To Account',
  'Transfer Ref (UTR)',
  'Released',
  'Created',
] as const;

const SORT_KEYS: Readonly<Record<string, PayoutSortField>> = {
  Amount: 'amount_paise',
  Released: 'released_at',
  Created: 'created_at',
};

function sortFieldOf(key: string | null): PayoutSortField {
  return key === 'amount_paise' || key === 'released_at' ? key : 'created_at';
}

interface SettlementPayoutsPanelProps {
  /** Open the settlement period a payout pays. */
  onOpenPeriod: (period: PeriodRef) => void;
}

/**
 * Payouts tab (appendix 09 R6) — every bank transfer Medibook made or holds
 * for the hospital (`GET /hospital/settlements/payouts`), with its status,
 * account and transfer reference. A row opens the period it pays. Status
 * filter, sort and paging run on the server.
 */
export function SettlementPayoutsPanel({ onOpenPeriod }: SettlementPayoutsPanelProps) {
  const [statusF, setStatusF] = useState(ALL_STATUSES);
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<never>({ key: 'created_at', dir: 'desc' });

  const status = STATUS_FILTER[statusF];
  const query = usePayoutsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    status,
    sortField: sortFieldOf(sort.key),
    sortDirection: sort.dir,
  });
  const rows = query.data?.items ?? [];

  const open = (p: Payout): void =>
    onOpenPeriod({
      id: p.settlementPeriodId,
      periodStart: p.periodStart ?? '',
      periodEnd: p.periodEnd ?? '',
    });

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
      icon: 'landmark',
      title: status ? `No ${statusF.toLowerCase()} payouts.` : 'No payouts yet.',
      message: status
        ? 'Choose another status to see the rest.'
        : 'Medibook creates a payout for each closed settlement period.',
      actionLabel: status ? 'Show all payouts' : undefined,
      onAction: status
        ? () => {
            setStatusF(ALL_STATUSES);
            setPage(0);
          }
        : undefined,
    };

  return (
    <Card pad={20}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.75">
          <SectionTitle size={16}>Payouts</SectionTitle>
          <InfoDot text="Each closed settlement period is paid by one bank transfer to your primary account. A payout on hold or failed is followed up by Medibook finance; open the row to see the period behind it." />
        </div>
        <FilterSelect
          value={statusF}
          options={STATUS_OPTIONS}
          aria-label="Filter payouts by status"
          onChange={(v) => {
            setStatusF(v);
            setPage(0);
          }}
        />
      </div>
      <TableShell
        columns={COLUMNS}
        rightCols={['Amount']}
        sortKeys={SORT_KEYS}
        sort={sort}
        onSort={(key) => {
          onSort(key);
          setPage(0);
        }}
        state={state}
        scrollLabel="Payouts"
      >
        {rows.map((p) => (
          <tr
            key={p.id}
            tabIndex={0}
            onClick={() => open(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(p);
              }
            }}
            aria-label={`Open the settlement period for payout of ${rupees(p.amountPaise)}`}
            className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
          >
            <td className={cn(tdClass, 'text-text-strong font-medium')}>
              {p.periodStart && p.periodEnd ? periodLabel(p.periodStart, p.periodEnd) : '—'}
            </td>
            <td className={cn(tdClass, 'text-text-strong text-right font-semibold tabular-nums')}>
              {rupees(p.amountPaise)}
            </td>
            <td className={tdClass}>
              <Badge status={PAYOUT_STATUS[p.status].badge}>{PAYOUT_STATUS[p.status].label}</Badge>
              {p.failureReason && (
                <div className="text-caption text-d-700 mt-1">{p.failureReason}</div>
              )}
            </td>
            <td className={tdClass}>{p.bankAccountLast4 ? `•••• ${p.bankAccountLast4}` : '—'}</td>
            <td className={tdClass}>{p.utrRef ?? '—'}</td>
            <td className={tdClass}>{fmtDateTime(p.releasedAt)}</td>
            <td className={tdClass}>{fmtDateTime(p.createdAt)}</td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="payouts"
      />
    </Card>
  );
}
