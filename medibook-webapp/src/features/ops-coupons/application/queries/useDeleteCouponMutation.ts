import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { couponsKeys } from '@/features/ops-coupons/application/queries/coupons.keys';
import { removeCoupon } from '@/features/ops-coupons/application/usecases/removeCoupon';
import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';

/** Delete a Medibook coupon (soft; its uses are kept). */
export function useDeleteCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (coupon: PlatformCoupon) => unwrap(await removeCoupon(coupon)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });
}
