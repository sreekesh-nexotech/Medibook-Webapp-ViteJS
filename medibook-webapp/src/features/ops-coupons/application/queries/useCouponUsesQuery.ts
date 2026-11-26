import { useQuery } from '@tanstack/react-query';

import { QUERY_STALE_TIME_MS } from '@/core/config/api';
import { unwrap } from '@/core/error/failure';

import { couponsKeys } from '@/features/ops-coupons/application/queries/coupons.keys';
import { fetchCouponUses } from '@/features/ops-coupons/application/usecases/fetchCouponUses';

/** The bookings that used a coupon; idle while `id` is null. */
export function useCouponUsesQuery(id: string | null) {
  return useQuery({
    queryKey: couponsKeys.uses(id ?? ''),
    queryFn: async () => unwrap(await fetchCouponUses(id ?? '')),
    staleTime: QUERY_STALE_TIME_MS,
    enabled: id !== null,
  });
}
