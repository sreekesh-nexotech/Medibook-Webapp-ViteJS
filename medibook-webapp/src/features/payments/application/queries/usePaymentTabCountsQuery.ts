import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  PaymentCountFilters,
  PaymentLineStatus,
} from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPayments } from '@/features/payments/application/usecases/fetchPayments';
import { fetchRefunds } from '@/features/payments/application/usecases/fetchRefunds';

/** A count request reads only the page's `total`, so one row is enough. */
const COUNT_PAGE_SIZE = 1;

/**
 * Tab counts for the Payments list. `null` where the server cannot give a
 * count that matches what the tab shows: lines on a backend that cannot
 * filter by channel while a channel is chosen, or refunds while searching
 * (the refunds list has no server search).
 */
export interface PaymentTabCounts<K extends string> {
  readonly lines: Readonly<Record<K, number | null>>;
  readonly refunds: number | null;
}

/**
 * Counts for the Payments tabs under the screen's filters: one light
 * `page_size=1` request per line tab and one for refunds asked for in the
 * window, reading each page's `total` — the same way the Appointments tabs
 * are counted.
 */
export function usePaymentTabCountsQuery<K extends string>(
  filters: PaymentCountFilters,
  statusSets: Readonly<Record<K, readonly PaymentLineStatus[]>>,
) {
  return useQuery({
    queryKey: paymentsKeys.tabCounts(filters, statusSets),
    queryFn: async (): Promise<PaymentTabCounts<K>> => {
      const tabs = Object.keys(statusSets) as K[];
      const [lineTotals, refunds] = await Promise.all([
        Promise.all(
          tabs.map(async (tab) => {
            const page = unwrap(
              await fetchPayments({
                ...filters,
                statuses: statusSets[tab],
                page: 1,
                pageSize: COUNT_PAGE_SIZE,
                sortField: 'captured_at',
                sortDirection: 'desc',
              }),
            );
            const counted = page.isChannelFiltered || filters.channel === null;
            return [tab, counted ? page.total : null] as const;
          }),
        ),
        filters.q === ''
          ? fetchRefunds({
              dateFrom: filters.dateFrom,
              dateTo: filters.dateTo,
              statuses: [],
              method: filters.method,
              page: 1,
              pageSize: COUNT_PAGE_SIZE,
            }).then((result) => unwrap(result).total)
          : Promise.resolve(null),
      ]);
      return {
        lines: Object.fromEntries(lineTotals) as Record<K, number | null>,
        refunds,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
