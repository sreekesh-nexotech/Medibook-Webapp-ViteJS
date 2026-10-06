import { takeSession } from '@/core/api/http';
import { attempt } from '@/core/error/attempt';

import type { StaffSession } from '@/features/auth/domain/entities/auth.types';
import {
  hospitalMeResponseSchema,
  platformMeResponseSchema,
  toHospitalSession,
  toPlatformSession,
} from '@/features/auth/infrastructure/data-sources/remote/auth.response';
import type { ProfileRepository } from '@/features/profile/domain/repositories/profile.repository';
import {
  deleteSession,
  getSessions,
  patchMe,
  postLogoutAll,
  postMePassword,
} from '@/features/profile/infrastructure/data-sources/remote/profile.api';
import { toActiveSession } from '@/features/profile/infrastructure/data-sources/remote/profile.response';

export const profileRepository: ProfileRepository = {
  updateName: (surface, change, version) =>
    attempt(async (): Promise<StaffSession> => {
      const body = await patchMe(surface, change, version);
      return surface === 'hospital'
        ? toHospitalSession(hospitalMeResponseSchema.parse(body))
        : toPlatformSession(platformMeResponseSchema.parse(body));
    }),

  changePassword: (surface, change) =>
    attempt(async () => {
      await postMePassword(surface, change);
      return null;
    }),

  listSessions: (surface) => attempt(async () => (await getSessions(surface)).map(toActiveSession)),

  revokeSession: (surface, sessionId) =>
    attempt(async () => {
      await deleteSession(surface, sessionId);
      return null;
    }),

  logoutEverywhere: (surface) =>
    attempt(async () => {
      await postLogoutAll(surface);
      // This browser's other tabs are signed out too (SEC-10).
      takeSession(surface);
      return null;
    }),
};
