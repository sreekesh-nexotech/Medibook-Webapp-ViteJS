import { useQuery } from '@tanstack/react-query';

import { QUERY_STALE_TIME_MS } from '@/core/config/api';
import { unwrap } from '@/core/error/failure';

import { couponsKeys } from '@/features/ops-coupons/application/queries/coupons.keys';
import { fetchCoupons } from '@/features/ops-coupons/application/usecases/fetchCoupons';

/** Every Medibook coupon. */
export function useOpsCouponsQuery() {
  return useQuery({
    queryKey: couponsKeys.list(),
    queryFn: async () => unwrap(await fetchCoupons()),
    staleTime: QUERY_STALE_TIME_MS,
  });
}
