import type { PlatformUserListParams } from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/**
 * `UserBlockRequest` (`schema.yml`) — required on block, unblock and unlock
 * alike, though the server only reads it on block.
 */
export interface UserBlockRequest {
  readonly reason: string;
}

/** Query string for `GET /platform/users` (`views/users_list.py` allowlist). */
export interface PlatformUsersListQuery {
  readonly page: number;
  readonly page_size: number;
  readonly q?: string;
  readonly status?: string;
  readonly sort?: string;
}

export function toListQuery(params: PlatformUserListParams): PlatformUsersListQuery {
  const q = params.q.trim();
  return {
    page: params.page,
    page_size: params.pageSize,
    ...(q ? { q } : {}),
    ...(params.statuses.length > 0 ? { status: params.statuses.join(',') } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
  };
}
