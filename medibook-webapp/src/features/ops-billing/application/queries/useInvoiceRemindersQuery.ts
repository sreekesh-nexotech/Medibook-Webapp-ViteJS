import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchInvoiceReminders } from '@/features/ops-billing/application/usecases/fetchInvoiceReminders';

/** The invoice's reminder history (queued and sent dunning events), newest first. */
export function useInvoiceRemindersQuery(invoiceId: string) {
  return useQuery({
    queryKey: billingKeys.reminders(invoiceId),
    queryFn: async () => unwrap(await fetchInvoiceReminders(invoiceId)),
    enabled: invoiceId !== '',
    staleTime: BILLING_STALE_TIME_MS,
  });
}
