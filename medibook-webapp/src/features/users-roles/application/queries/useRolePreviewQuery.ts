import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ROLES_STALE_TIME_MS,
  usersRolesKeys,
} from '@/features/users-roles/application/queries/usersRoles.keys';
import { fetchRolePreview } from '@/features/users-roles/application/usecases/fetchRolePreview';
import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';

/** The server-computed effective access of one role; idle while `roleCode` is null. */
export function useRolePreviewQuery(roleCode: StaffRoleCode | null) {
  return useQuery({
    queryKey: usersRolesKeys.preview(roleCode ?? 'admin'),
    queryFn: async () => unwrap(await fetchRolePreview(roleCode ?? 'admin')),
    enabled: roleCode !== null,
    staleTime: ROLES_STALE_TIME_MS,
  });
}
