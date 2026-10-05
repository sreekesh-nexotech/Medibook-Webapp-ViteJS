import type { StaffRoleCode } from '@/features/users-roles/domain/entities/usersRoles.types';

/** Query keys for the Users & Roles screen. */
export const usersRolesKeys = {
  all: ['users-roles'] as const,
  staff: () => [...usersRolesKeys.all, 'staff'] as const,
  invitations: () => [...usersRolesKeys.all, 'invitations'] as const,
  roles: () => [...usersRolesKeys.all, 'roles'] as const,
  previews: () => [...usersRolesKeys.all, 'preview'] as const,
  preview: (roleCode: StaffRoleCode) => [...usersRolesKeys.previews(), roleCode] as const,
};

/**
 * The four role grids change only when an administrator saves one (and every
 * save invalidates them), so they stay fresh for longer than the staff list.
 */
export const ROLES_STALE_TIME_MS = 5 * 60_000;
