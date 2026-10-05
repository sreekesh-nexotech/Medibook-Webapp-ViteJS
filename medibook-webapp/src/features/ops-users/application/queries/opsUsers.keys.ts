/** Query keys for ops Users & Roles (standards §4 — no inline key arrays). */
export const opsUsersKeys = {
  all: ['ops-users'] as const,
  staff: () => [...opsUsersKeys.all, 'staff'] as const,
  roles: () => [...opsUsersKeys.all, 'roles'] as const,
  permissions: () => [...opsUsersKeys.all, 'permissions'] as const,
};
