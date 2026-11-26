import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import type { PageParams } from '@/core/api/pagination';

import type { CouponWriteRequest } from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.request';
import {
  couponPageResponseSchema,
  couponResponseSchema,
  couponUsePageResponseSchema,
} from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.response';

const COUPONS_PATH = '/coupons';

const one = (id: string) => `${COUPONS_PATH}/${encodeURIComponent(id)}`;

/** `GET /platform/coupons` — Medibook's coupons only, newest first. */
export async function getCouponsPage(params: Required<PageParams>) {
  const response = await platformApi.get(COUPONS_PATH, { params });
  return couponPageResponseSchema.parse(response.data);
}

/** `POST /platform/coupons` */
export async function postCoupon(body: CouponWriteRequest) {
  const response = await platformApi.post(COUPONS_PATH, body);
  return couponResponseSchema.parse(response.data);
}

/** `PATCH /platform/coupons/{id}` — `If-Match` is mandatory. */
export async function patchCoupon(id: string, version: number, body: Partial<CouponWriteRequest>) {
  const response = await platformApi.patch(one(id), body, { headers: ifMatch(version) });
  return couponResponseSchema.parse(response.data);
}

/** `DELETE /platform/coupons/{id}` — soft delete; its uses are kept. */
export async function deleteCoupon(id: string, version: number): Promise<void> {
  await platformApi.delete(one(id), { headers: ifMatch(version) });
}

/** `GET /platform/coupons/{id}/redemptions` — newest first. */
export async function getCouponUsesPage(id: string, params: Required<PageParams>) {
  const response = await platformApi.get(`${one(id)}/redemptions`, { params });
  return couponUsePageResponseSchema.parse(response.data);
}
