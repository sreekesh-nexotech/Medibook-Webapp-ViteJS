import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchInvoices } from '@/features/settlements/application/usecases/fetchInvoices';

/** Invoices are issued monthly. */
const INVOICES_STALE_TIME_MS = 5 * 60_000;

/** One page of subscription invoices (`page` is 1-based, as the backend counts). */
export function useInvoicesQuery(page: number, pageSize: number) {
  return useQuery({
    queryKey: billingKeys.invoices(page, pageSize),
    queryFn: async () => unwrap(await fetchInvoices(page, pageSize)),
    placeholderData: keepPreviousData,
    staleTime: INVOICES_STALE_TIME_MS,
  });
}
