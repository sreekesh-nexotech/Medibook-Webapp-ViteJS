import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { RefundListQuery } from '@/features/payments/domain/entities/payments.entities';
import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchRefunds } from '@/features/payments/application/usecases/fetchRefunds';

/** One page of the Refunds tab. Idle when `enabled` is false. */
export function useRefundPageQuery(query: RefundListQuery, enabled: boolean) {
  return useQuery({
    queryKey: paymentsKeys.refundPage(query),
    queryFn: async () => unwrap(await fetchRefunds(query)),
    placeholderData: keepPreviousData,
    staleTime: PAYMENTS_STALE_TIME_MS,
    enabled,
  });
}
