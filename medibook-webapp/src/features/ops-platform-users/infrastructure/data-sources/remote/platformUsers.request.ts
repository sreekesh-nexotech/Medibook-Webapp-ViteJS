import type {
  PlatformUserCountFilter,
  PlatformUserListParams,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/** A count needs only the envelope's `total`. */
const COUNT_PAGE_SIZE = 1;

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
  /** B2 (BE-31): registered on or after this `yyyy-mm-dd`. */
  readonly created_from?: string;
  /** B2 (BE-31): signed in on or after this `yyyy-mm-dd`. */
  readonly last_login_from?: string;
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

/** One-row query whose `total` is the tile's count; B2 filters only when set. */
export function toCountQuery(filter: PlatformUserCountFilter): PlatformUsersListQuery {
  return {
    page: 1,
    page_size: COUNT_PAGE_SIZE,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.createdFrom ? { created_from: filter.createdFrom } : {}),
    ...(filter.lastLoginFrom ? { last_login_from: filter.lastLoginFrom } : {}),
  };
}
