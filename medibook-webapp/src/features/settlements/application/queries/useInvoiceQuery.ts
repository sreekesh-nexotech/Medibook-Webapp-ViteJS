import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchInvoice } from '@/features/settlements/application/usecases/fetchInvoice';

/** An issued invoice only changes when it is paid. */
const INVOICE_STALE_TIME_MS = 60_000;

/** One invoice with lines and party snapshots; idle until `invoiceId` is set. */
export function useInvoiceQuery(invoiceId: string | null) {
  return useQuery({
    queryKey: billingKeys.invoice(invoiceId ?? ''),
    queryFn: async () => unwrap(await fetchInvoice(invoiceId ?? '')),
    enabled: invoiceId !== null,
    staleTime: INVOICE_STALE_TIME_MS,
  });
}
