import { ifMatch } from '@/core/api/headers';
import { apiFor } from '@/core/api/http';
import { fetchAllPages } from '@/core/api/pagination';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import type { NameChange, PasswordChange } from '@/features/profile/domain/entities/profile.types';
import type { ActiveSessionResponse } from '@/features/profile/infrastructure/data-sources/remote/profile.response';
import { activeSessionsPageResponseSchema } from '@/features/profile/infrastructure/data-sources/remote/profile.response';

/** `PATCH /<surface>/me` — returns the same body as `GET /me` (validated by the caller). */
export async function patchMe(
  surface: AuthSurface,
  change: NameChange,
  version: number,
): Promise<unknown> {
  const response = await apiFor(surface).patch(
    '/me',
    { first_name: change.firstName, last_name: change.lastName || null },
    { headers: ifMatch(version) },
  );
  return response.data;
}

export async function postMePassword(surface: AuthSurface, change: PasswordChange): Promise<void> {
  await apiFor(surface).post('/me/password', {
    current_password: change.currentPassword,
    new_password: change.newPassword,
  });
}

export async function getSessions(surface: AuthSurface): Promise<ActiveSessionResponse[]> {
  return fetchAllPages(async (params) => {
    const response = await apiFor(surface).get('/auth/sessions', { params });
    return activeSessionsPageResponseSchema.parse(response.data);
  });
}

export async function deleteSession(surface: AuthSurface, sessionId: string): Promise<void> {
  await apiFor(surface).delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
}

export async function postLogoutAll(surface: AuthSurface): Promise<void> {
  await apiFor(surface).post('/auth/logout-all');
}
