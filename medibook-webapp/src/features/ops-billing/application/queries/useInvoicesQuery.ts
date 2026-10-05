import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { InvoiceListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchInvoices } from '@/features/ops-billing/application/usecases/fetchInvoices';

/** One server-side page of subscription invoices (also used with page size 1 for counts). */
export function useInvoicesQuery(params: InvoiceListParams) {
  return useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: async () => unwrap(await fetchInvoices(params)),
    placeholderData: keepPreviousData,
    staleTime: BILLING_STALE_TIME_MS,
  });
}
