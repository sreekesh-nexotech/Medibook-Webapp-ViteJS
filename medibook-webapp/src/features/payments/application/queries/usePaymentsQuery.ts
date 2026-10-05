import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentPageQuery } from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPayments } from '@/features/payments/application/usecases/fetchPayments';

/** One server page of payment lines. Pass `enabled: false` for tabs that show none. */
export function usePaymentsQuery(query: PaymentPageQuery, enabled = true) {
  return useQuery({
    queryKey: paymentsKeys.page(query),
    queryFn: async () => unwrap(await fetchPayments(query)),
    placeholderData: keepPreviousData,
    staleTime: PAYMENTS_STALE_TIME_MS,
    enabled,
  });
}
