import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';

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
  bannerListResponseSchema,
  bannerResponseSchema,
  holidayListResponseSchema,
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
  const response = await hospitalApi.get(HOLIDAYS_PATH);
  return holidayListResponseSchema.parse(response.data);
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
  const response = await hospitalApi.patch(`${HOLIDAYS_PATH}/${id}`, body, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteHoliday(id: string, confirm: boolean): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(`${HOLIDAYS_PATH}/${id}`, {
    params: confirmParams(confirm),
    headers: idempotencyKey(),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function listBanners(): Promise<readonly BannerResponse[]> {
  const response = await hospitalApi.get(BANNERS_PATH);
  return bannerListResponseSchema.parse(response.data);
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
  const response = await hospitalApi.patch(`${BANNERS_PATH}/${id}`, body, {
    headers: ifMatch(version),
  });
  return bannerResponseSchema.parse(response.data);
}

export async function deleteBanner(id: string, version: number): Promise<void> {
  await hospitalApi.delete(`${BANNERS_PATH}/${id}`, { headers: ifMatch(version) });
}
