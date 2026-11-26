import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { couponsKeys } from '@/features/ops-coupons/application/queries/coupons.keys';
import { saveCoupon } from '@/features/ops-coupons/application/usecases/saveCoupon';
import type {
  PlatformCoupon,
  PlatformCouponInput,
} from '@/features/ops-coupons/domain/entities/coupons.entities';

interface SaveCouponInput {
  /** The coupon being edited, or null to create one. */
  readonly target: PlatformCoupon | null;
  readonly input: PlatformCouponInput;
}

/** Create or edit a Medibook coupon. */
export function useSaveCouponMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, input }: SaveCouponInput) =>
      unwrap(await saveCoupon(target, input)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });
}
