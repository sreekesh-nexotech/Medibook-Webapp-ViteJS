import type {
  PlatformUserListParams,
  PlatformUserStatus,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';

/** Query keys for patient accounts (ops console). */
export const platformUsersKeys = {
  all: ['platform-users'] as const,
  lists: () => [...platformUsersKeys.all, 'list'] as const,
  list: (params: PlatformUserListParams) => [...platformUsersKeys.lists(), params] as const,
  counts: () => [...platformUsersKeys.all, 'count'] as const,
  count: (status: PlatformUserStatus | null) => [...platformUsersKeys.counts(), status] as const,
  details: () => [...platformUsersKeys.all, 'detail'] as const,
  detail: (id: string) => [...platformUsersKeys.details(), id] as const,
};
