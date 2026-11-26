import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { couponsKeys } from '@/features/ops-coupons/application/queries/coupons.keys';
import { setCouponActive } from '@/features/ops-coupons/application/usecases/setCouponActive';
import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';

/** Pause or resume a Medibook coupon. */
export function useToggleCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ coupon, active }: { coupon: PlatformCoupon; active: boolean }) =>
      unwrap(await setCouponActive(coupon, active)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });
}
