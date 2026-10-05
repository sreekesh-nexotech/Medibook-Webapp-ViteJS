import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { BannerWriteRequest } from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.request';
import type {
  BannerResponse,
  BannersPageResponse,
} from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.response';
import {
  bannerResponseSchema,
  bannersPageResponseSchema,
} from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.response';

const BANNERS_PATH = '/banners';

/** `GET /platform/banners` — one page, in the default `sort_order, -created_at` order. */
export async function getBannersPage(page: number): Promise<BannersPageResponse> {
  const response = await platformApi.get(BANNERS_PATH, {
    params: { page, page_size: MAX_PAGE_SIZE },
  });
  return bannersPageResponseSchema.parse(response.data);
}

/** `POST /platform/banners` */
export async function postBanner(body: BannerWriteRequest): Promise<BannerResponse> {
  const response = await platformApi.post(BANNERS_PATH, body);
  return bannerResponseSchema.parse(response.data);
}

/** `PATCH /platform/banners/{id}` — `If-Match` is mandatory. */
export async function patchBanner(
  id: string,
  version: number,
  body: BannerWriteRequest,
): Promise<BannerResponse> {
  const response = await platformApi.patch(`${BANNERS_PATH}/${id}`, body, {
    headers: ifMatch(version),
  });
  return bannerResponseSchema.parse(response.data);
}

/** `DELETE /platform/banners/{id}` — soft delete, guarded by `If-Match`. */
export async function deleteBanner(id: string, version: number): Promise<void> {
  await platformApi.delete(`${BANNERS_PATH}/${id}`, { headers: ifMatch(version) });
}
