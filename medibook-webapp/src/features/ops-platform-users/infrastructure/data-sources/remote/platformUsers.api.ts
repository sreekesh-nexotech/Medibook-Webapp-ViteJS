import { idempotencyKey } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  PlatformUsersListQuery,
  UserBlockRequest,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.request';
import type {
  CancelBookingsPreviewResponse,
  CancelBookingsResultResponse,
  PlatformUserDetailResponse,
  PlatformUserSummaryResponse,
  PlatformUsersPageResponse,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';
import {
  cancelBookingsPreviewResponseSchema,
  cancelBookingsResultResponseSchema,
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

/** `GET /platform/users/{id}/cancel-bookings` — the dry run: writes nothing, needs no key. */
export async function getCancelBookingsPreview(id: string): Promise<CancelBookingsPreviewResponse> {
  const response = await platformApi.get(`/users/${encodeURIComponent(id)}/cancel-bookings`);
  return cancelBookingsPreviewResponseSchema.parse(response.data);
}

/**
 * `POST /platform/users/{id}/cancel-bookings` — cancels with a full refund and tells the
 * patient. Money mutation: `Idempotency-Key` (D-21); 409 `STATE_CONFLICT` unless blocked.
 */
export async function postCancelBookings(
  id: string,
  replayKey: string,
): Promise<CancelBookingsResultResponse> {
  const response = await platformApi.post(
    `/users/${encodeURIComponent(id)}/cancel-bookings`,
    {},
    { headers: idempotencyKey(replayKey) },
  );
  return cancelBookingsResultResponseSchema.parse(response.data);
}
