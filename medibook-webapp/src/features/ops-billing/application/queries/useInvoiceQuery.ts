import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchInvoice } from '@/features/ops-billing/application/usecases/fetchInvoice';

/** One invoice with its line items and the parties as they were when it was issued. */
export function useInvoiceQuery(id: string) {
  return useQuery({
    queryKey: billingKeys.invoice(id),
    queryFn: async () => unwrap(await fetchInvoice(id)),
    enabled: id !== '',
    staleTime: BILLING_STALE_TIME_MS,
  });
}
