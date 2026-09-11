import { create } from 'zustand';

import { SEED_ROLES, SEED_USERS } from './rbac.fixtures';
import type { HospitalUser, Role } from './rbac.types';

/**
 * Users & Roles (hospital RBAC) store — admin-defined roles with granular
 * CRUD permissions plus hospital staff users. Actions ported 1:1 from the
 * design prototype (`data.jsx` `rbacAddRole` / `rbacUpdateRole` /
 * `rbacDeleteRole` / `rbacAddUser` / `rbacUpdateUser`), with one deliberate
 * departure: `rbacDeleteRole` refuses to orphan users (audit 3.6.3).
 */

interface RbacState {
  roles: readonly Role[];
  users: readonly HospitalUser[];
}

interface RbacActions {
  rbacAddRole: (role: Role) => void;
  rbacUpdateRole: (id: string, patch: Partial<Role>) => void;
  /**
   * Delete a role. Audit 3.6.3 — "deleting a custom role leaves the users who
   * held it pointing at a role that no longer exists" — so deletion is now a
   * single atomic operation that either reassigns every holder to
   * `reassignToRoleId` or does nothing at all.
   *
   * Returns `false` (having written nothing) when the delete would break
   * referential integrity or is not allowed:
   *   - the role does not exist, or is the locked system role;
   *   - it still has holders and no valid, different target role was given.
   * The caller shows the reason; the store never leaves a dangling `roleId`.
   */
  rbacDeleteRole: (id: string, reassignToRoleId?: string) => boolean;
  rbacAddUser: (u: HospitalUser) => void;
  rbacUpdateUser: (id: string, patch: Partial<HospitalUser>) => void;
}

/** The users currently holding `roleId` — the holder count a delete must clear. */
export function roleHolders(
  users: readonly HospitalUser[],
  roleId: string,
): readonly HospitalUser[] {
  return users.filter((u) => u.roleId === roleId);
}

export const useRbacStore = create<RbacState & RbacActions>()((set, get) => ({
  roles: SEED_ROLES,
  users: SEED_USERS,

  rbacAddRole: (role) => set((s) => ({ roles: [...s.roles, role] })),

  rbacUpdateRole: (id, patch) =>
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  rbacDeleteRole: (id, reassignToRoleId) => {
    const { roles, users } = get();
    const role = roles.find((r) => r.id === id);
    if (!role || role.system === true) return false;

    const holders = roleHolders(users, id);
    if (holders.length === 0) {
      set({ roles: roles.filter((r) => r.id !== id) });
      return true;
    }

    const target = roles.find((r) => r.id === reassignToRoleId);
    if (!target || target.id === id) return false;

    // One write: the holders move first, so no render ever observes a user
    // whose role has already been deleted.
    set({
      roles: roles.filter((r) => r.id !== id),
      users: users.map((u) => (u.roleId === id ? { ...u, roleId: target.id } : u)),
    });
    return true;
  },

  rbacAddUser: (u) => set((s) => ({ users: [u, ...s.users] })),

  rbacUpdateUser: (id, patch) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
}));
