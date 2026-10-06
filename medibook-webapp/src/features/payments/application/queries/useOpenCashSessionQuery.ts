import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PAYMENTS_STALE_TIME_MS,
  paymentsKeys,
} from '@/features/payments/application/queries/payments.keys';
import { fetchOpenCashSession } from '@/features/payments/application/usecases/fetchOpenCashSession';

/** The staff member's open drawer (`null` when closed). `null` staff stays idle. */
export function useOpenCashSessionQuery(staffId: string | null) {
  return useQuery({
    queryKey: paymentsKeys.openCash(staffId ?? ''),
    queryFn: async () => unwrap(await fetchOpenCashSession(staffId ?? '')),
    enabled: staffId !== null,
    staleTime: PAYMENTS_STALE_TIME_MS,
  });
}
