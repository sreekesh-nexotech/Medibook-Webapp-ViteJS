import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type {
  BannerWriteRequest,
  HolidayWriteRequest,
} from '@/features/settings/infrastructure/data-sources/remote/profile.request';
import type {
  HolidayRef,
  HolidayWriteMode,
} from '@/features/settings/domain/entities/profile.entities';
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
 * server-side: each carries the caller's `Idempotency-Key` (fresh per dry
 * run, one per confirmed action — 07·P-F9) and an edit carries `If-Match`
 * (the backend's `require_version`, kept by decision 10 — UAT-05).
 */

const HOLIDAYS_PATH = '/holidays';
const BANNERS_PATH = '/banners';

/** Query parameter carrying the dry run's preview token on confirm (BE-33). */
const PREVIEW_TOKEN_PARAM = 'preview_token';

function writeParams(mode: HolidayWriteMode): Readonly<Record<string, string>> {
  if (!mode.confirm) return {};
  return {
    confirm: 'true',
    ...(mode.previewToken ? { [PREVIEW_TOKEN_PARAM]: mode.previewToken } : {}),
  };
}

export async function listHolidays(): Promise<readonly HolidayResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await hospitalApi.get(HOLIDAYS_PATH, { params });
    return holidayPageResponseSchema.parse(response.data);
  });
}

export async function postHoliday(
  body: HolidayWriteRequest,
  mode: HolidayWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(HOLIDAYS_PATH, body, {
    params: writeParams(mode),
    headers: idempotencyKey(mode.idempotencyKey),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchHoliday(
  holiday: HolidayRef,
  body: HolidayWriteRequest,
  mode: HolidayWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `${HOLIDAYS_PATH}/${encodeURIComponent(holiday.id)}`,
    body,
    {
      params: writeParams(mode),
      headers: { ...ifMatch(holiday.version), ...idempotencyKey(mode.idempotencyKey) },
    },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

/** DELETE honours `If-Match` when sent (`check_version_if_sent`): a stale row is refused. */
export async function deleteHoliday(
  holiday: HolidayRef,
  mode: HolidayWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(`${HOLIDAYS_PATH}/${encodeURIComponent(holiday.id)}`, {
    params: writeParams(mode),
    headers: { ...ifMatch(holiday.version), ...idempotencyKey(mode.idempotencyKey) },
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
