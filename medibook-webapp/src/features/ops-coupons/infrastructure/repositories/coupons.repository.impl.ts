import { fetchAllPages } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { CouponsRepository } from '@/features/ops-coupons/domain/repositories/coupons.repository';
import {
  deleteCoupon,
  getCouponsPage,
  getCouponUsesPage,
  patchCoupon,
  postCoupon,
} from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.api';
import { toCouponWriteRequest } from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.request';
import {
  toCouponUse,
  toPlatformCoupon,
} from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.response';

export const couponsRepository: CouponsRepository = {
  listCoupons: () =>
    attempt(async () => (await fetchAllPages(getCouponsPage)).map(toPlatformCoupon)),

  createCoupon: (input) =>
    attempt(async () => toPlatformCoupon(await postCoupon(toCouponWriteRequest(input)))),

  updateCoupon: (id, version, input) =>
    attempt(async () =>
      toPlatformCoupon(await patchCoupon(id, version, toCouponWriteRequest(input))),
    ),

  setActive: (id, version, active) =>
    attempt(async () => toPlatformCoupon(await patchCoupon(id, version, { is_active: active }))),

  deleteCoupon: (id, version) =>
    attempt(async () => {
      await deleteCoupon(id, version);
      return null;
    }),

  listUses: (id) =>
    attempt(async () =>
      (await fetchAllPages((params) => getCouponUsesPage(id, params))).map(toCouponUse),
    ),
};
