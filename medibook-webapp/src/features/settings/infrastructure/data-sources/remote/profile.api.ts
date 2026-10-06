import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type {
  BannerWriteRequest,
  HolidayWriteRequest,
} from '@/features/settings/infrastructure/data-sources/remote/profile.request';
import type {
  BannerResponse,
  HolidayResponse,
  ScheduleChangeResponse,
} from '@/features/settings/infrastructure/data-sources/remote/profile.response';
import {
  bannerPageResponseSchema,
  bannerResponseSchema,
  holidayPageResponseSchema,
  scheduleChangeResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/profile.response';

/**
 * Hospital Profile endpoints (`/api/v1/hospital/…`). Every body is
 * Zod-validated. Holiday writes are dry-run/confirm and declared idempotent
 * server-side, so each carries a fresh `Idempotency-Key` (the backend
 * requires one on every holiday POST/PATCH/DELETE, dry run included).
 */

const HOLIDAYS_PATH = '/holidays';
const BANNERS_PATH = '/banners';

function confirmParams(confirm: boolean): Readonly<Record<string, string>> {
  return confirm ? { confirm: 'true' } : {};
}

export async function listHolidays(): Promise<readonly HolidayResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(HOLIDAYS_PATH, { params });
    return holidayPageResponseSchema.parse(response.data);
  });
}

export async function postHoliday(
  body: HolidayWriteRequest,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(HOLIDAYS_PATH, body, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchHoliday(
  id: string,
  body: HolidayWriteRequest,
  confirm: boolean,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(`${HOLIDAYS_PATH}/${encodeURIComponent(id)}`, body, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteHoliday(id: string, confirm: boolean): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(`${HOLIDAYS_PATH}/${encodeURIComponent(id)}`, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function listBanners(): Promise<readonly BannerResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(BANNERS_PATH, { params });
    return bannerPageResponseSchema.parse(response.data);
  });
}

export async function postBanner(body: BannerWriteRequest): Promise<BannerResponse> {
  const response = await hospitalApi.post(BANNERS_PATH, body);
  return bannerResponseSchema.parse(response.data);
}

export async function patchBanner(
  id: string,
  body: BannerWriteRequest,
  version: number,
): Promise<BannerResponse> {
  const response = await hospitalApi.patch(`${BANNERS_PATH}/${encodeURIComponent(id)}`, body, {
    headers: ifMatch(version),
  });
  return bannerResponseSchema.parse(response.data);
}

export async function deleteBanner(id: string, version: number): Promise<void> {
  await hospitalApi.delete(`${BANNERS_PATH}/${encodeURIComponent(id)}`, {
    headers: ifMatch(version),
  });
}
