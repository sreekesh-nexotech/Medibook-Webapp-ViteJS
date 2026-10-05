import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { BILLING_STALE_TIME_MS } from '@/features/ops-billing/application/queries/billing.config';
import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { fetchPayments } from '@/features/ops-billing/application/usecases/fetchPayments';

/** One server-side page of subscription payments. */
export function usePaymentsQuery(params: PaymentListParams, enabled = true) {
  return useQuery({
    queryKey: billingKeys.payments(params),
    queryFn: async () => unwrap(await fetchPayments(params)),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: BILLING_STALE_TIME_MS,
  });
}
