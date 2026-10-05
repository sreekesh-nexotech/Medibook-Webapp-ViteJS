import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentFilters } from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchPaymentTotals } from '@/features/payments/application/usecases/fetchPaymentTotals';

/** Every payment line matching `filters` (all pages) — the KPI strip's source. */
export function usePaymentTotalsQuery(filters: PaymentFilters) {
  return useQuery({
    queryKey: paymentsKeys.totals(filters),
    queryFn: async () => unwrap(await fetchPaymentTotals(filters)),
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
