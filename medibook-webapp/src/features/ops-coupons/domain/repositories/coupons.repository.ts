import type { Result } from '@/core/error/failure';

import type {
  PlatformCoupon,
  PlatformCouponInput,
  PlatformCouponUse,
} from '@/features/ops-coupons/domain/entities/coupons.entities';

/** Medibook Operations' coupons (`/platform/coupons`, `settings.*`). */
export interface CouponsRepository {
  /** Every Medibook coupon, newest first. */
  listCoupons(): Promise<Result<readonly PlatformCoupon[]>>;
  createCoupon(input: PlatformCouponInput): Promise<Result<PlatformCoupon>>;
  /** `version` guards against a concurrent change. */
  updateCoupon(
    id: string,
    version: number,
    input: PlatformCouponInput,
  ): Promise<Result<PlatformCoupon>>;
  setActive(id: string, version: number, active: boolean): Promise<Result<PlatformCoupon>>;
  /** Soft delete. */
  deleteCoupon(id: string, version: number): Promise<Result<null>>;
  /** Every booking that used it. */
  listUses(id: string): Promise<Result<readonly PlatformCouponUse[]>>;
}
