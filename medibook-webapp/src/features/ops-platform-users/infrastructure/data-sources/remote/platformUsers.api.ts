import { platformApi } from '@/core/api/http';

import type {
  PlatformUsersListQuery,
  UserBlockRequest,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.request';
import type {
  PlatformUserDetailResponse,
  PlatformUserSummaryResponse,
  PlatformUsersPageResponse,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';
import {
  platformUserDetailResponseSchema,
  platformUserSummaryResponseSchema,
  platformUsersPageResponseSchema,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';

/** The three account actions (`routes/staff_users.py` `USER_ACTIONS`). */
export type PlatformUserAction = 'block' | 'unblock' | 'unlock';

/** `GET /platform/users` */
export async function getPlatformUsers(
  query: PlatformUsersListQuery,
): Promise<PlatformUsersPageResponse> {
  const response = await platformApi.get('/users', { params: query });
  return platformUsersPageResponseSchema.parse(response.data);
}

/** `GET /platform/users/{id}` */
export async function getPlatformUser(id: string): Promise<PlatformUserDetailResponse> {
  const response = await platformApi.get(`/users/${encodeURIComponent(id)}`);
  return platformUserDetailResponseSchema.parse(response.data);
}

/** `POST /platform/users/{id}/{block|unblock|unlock}` */
export async function postPlatformUserAction(
  id: string,
  action: PlatformUserAction,
  body: UserBlockRequest,
): Promise<PlatformUserSummaryResponse> {
  const response = await platformApi.post(
    `/users/${encodeURIComponent(id)}/${encodeURIComponent(action)}`,
    body,
  );
  return platformUserSummaryResponseSchema.parse(response.data);
}
