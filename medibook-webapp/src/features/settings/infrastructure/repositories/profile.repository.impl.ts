import { getFileUrl, uploadFile } from '@/core/api/files.api';
import { attempt } from '@/core/error/attempt';
import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import type { ProfileRepository } from '@/features/settings/domain/repositories/profile.repository';
import {
  deleteBanner,
  deleteHoliday,
  listBanners,
  listHolidays,
  patchBanner,
  patchHoliday,
  postBanner,
  postHoliday,
} from '@/features/settings/infrastructure/data-sources/remote/profile.api';
import {
  toBannerWriteRequest,
  toHolidayWriteRequest,
} from '@/features/settings/infrastructure/data-sources/remote/profile.request';
import {
  toHoliday,
  toHospitalBanner,
  toScheduleChange,
} from '@/features/settings/infrastructure/data-sources/remote/profile.response';

export const profileRepository: ProfileRepository = {
  listHolidays: () => attempt(async () => (await listHolidays()).map(toHoliday)),

  saveHoliday: (target, input, confirm, replayKey) =>
    attempt(async () => {
      const body = toHolidayWriteRequest(input);
      return toScheduleChange(
        target === null
          ? await postHoliday(body, confirm, replayKey)
          : await patchHoliday(target.id, body, confirm, target.version, replayKey),
      );
    }),

  removeHoliday: (target, confirm, replayKey) =>
    attempt(async () =>
      toScheduleChange(await deleteHoliday(target.id, confirm, target.version, replayKey)),
    ),

  listBanners: () => attempt(async () => (await listBanners()).map(toHospitalBanner)),

  createBanner: (input, sortOrder) =>
    attempt(async () =>
      toHospitalBanner(
        await postBanner(toBannerWriteRequest({ ...input, sortOrder, isEnabled: true })),
      ),
    ),

  updateBanner: (id, changes, version) =>
    attempt(async () =>
      toHospitalBanner(await patchBanner(id, toBannerWriteRequest(changes), version)),
    ),

  deleteBanner: (id, version) =>
    attempt(async () => {
      await deleteBanner(id, version);
      return null;
    }),

  uploadBannerImage: async (file): Promise<Result<string>> => {
    const uploaded = await uploadFile({ file, purpose: 'banner' });
    return uploaded.ok ? ok(uploaded.data.id) : uploaded;
  },

  getBannerImageUrl: async (fileId): Promise<Result<string>> => {
    const signed = await getFileUrl(fileId);
    return signed.ok ? ok(signed.data.url) : signed;
  },
};
