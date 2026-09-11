import { useMemo } from 'react';

import { useAuthStore, type AuthRole } from '@/features/auth/application/store/auth.store';
import { useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type PermAction,
  type PermsGrid,
  type RbacModule,
} from '@/features/users-roles/application/store/rbac.types';

/**
 * The shared half of audit 2.4 / X-01 / Q-03: "Permissions can be ticked, but
 * no screen ever looks different for a limited role, so the client cannot
 * validate what a receptionist or an accountant would actually see."
 *
 * This hook is the single place a screen asks "may this user do X?". It reads
 * the **existing** RBAC grid — the one the Users & Roles screen edits — so a
 * permission ticked there changes the UI immediately, with no parallel
 * vocabulary to keep in sync.
 *
 * ## Permission keys
 *
 * A key is `"<Module>.<action>"`, where `<Module>` is one of the ten
 * `RBAC_MODULES` strings **exactly as the store spells them** (display casing,
 * ampersands and spaces included) and `<action>` is one of the four
 * `PERM_ACTIONS` (`view` | `add` | `edit` | `del`). `PermissionKey` is a
 * template-literal union, so a typo is a compile error and editor completion
 * lists every valid key:
 *
 *   'Appointments.view'          'Payments.add'
 *   'Billing & Settlements.edit' 'Users & Roles.del'
 *   'Token Management.view'      'Doctors & Departments.edit'
 *
 * Read actions map to `view`, create to `add`, update/state-change to `edit`,
 * and destructive/irreversible actions (delete, refund, cancel-with-refund) to
 * `del`. There is no fifth action — do not invent one.
 */

/** Every valid permission key: `"<Module>.<action>"`. */
export type PermissionKey = `${RbacModule}.${PermAction}`;

/** Build a key from its parts (handy when the module comes from a data table). */
export function permissionKey(module: RbacModule, action: PermAction): PermissionKey {
  return `${module}.${action}`;
}

/**
 * Hospital auth roles map onto the seeded RBAC roles the store ships with.
 * `ops` is not governed by hospital RBAC — the operations console has its own
 * internal roles — so it is granted everything here and gated by `OpsGuard`.
 */
const AUTH_ROLE_TO_RBAC_ROLE_ID: Readonly<Record<AuthRole, string | null>> = {
  admin: 'r-admin',
  receptionist: 'r-reception',
  ops: null,
};

/** Split a key back into its parts, tolerating module names that contain dots. */
function parseKey(key: PermissionKey): { module: RbacModule; action: PermAction } | null {
  const at = key.lastIndexOf('.');
  if (at < 0) return null;
  const module = key.slice(0, at);
  const action = key.slice(at + 1);
  const isModule = (RBAC_MODULES as readonly string[]).includes(module);
  const isAction = (PERM_ACTIONS as readonly string[]).includes(action);
  if (!isModule || !isAction) return null;
  return { module: module as RbacModule, action: action as PermAction };
}

export interface UsePermissionResult {
  /** True when the current role has this permission. */
  can: (perm: PermissionKey) => boolean;
  /** True when the role has at least one of these. */
  canAny: (...perms: readonly PermissionKey[]) => boolean;
  /** True when the role has all of these. */
  canAll: (...perms: readonly PermissionKey[]) => boolean;
  /** True when the role may see the module at all (its `view` flag). */
  canViewModule: (module: RbacModule) => boolean;
  /** The RBAC role backing the current session, if any. */
  roleId: string | null;
  roleName: string | null;
  /** The whole grid, for screens that render a permission summary. */
  perms: PermsGrid | null;
}

export function usePermission(): UsePermissionResult {
  const authRole = useAuthStore((s) => s.role);
  const roles = useRbacStore((s) => s.roles);

  const roleId = AUTH_ROLE_TO_RBAC_ROLE_ID[authRole];
  const role = useMemo(
    () => (roleId ? (roles.find((r) => r.id === roleId) ?? null) : null),
    [roles, roleId],
  );

  return useMemo<UsePermissionResult>(() => {
    // No RBAC role behind this session (the ops console, or a role that was
    // deleted): fall back to "allowed", because the route guards — not this
    // hook — decide who reaches the console at all.
    const perms = role?.perms ?? null;
    const can = (perm: PermissionKey): boolean => {
      if (!perms) return true;
      const parsed = parseKey(perm);
      if (!parsed) return false;
      return perms[parsed.module][parsed.action];
    };
    return {
      can,
      canAny: (...list) => list.length === 0 || list.some(can),
      canAll: (...list) => list.every(can),
      canViewModule: (module) => (perms ? perms[module].view : true),
      roleId: role?.id ?? null,
      roleName: role?.name ?? null,
      perms,
    };
  }, [role]);
}

/** One-liner for a single check: `const mayRefund = useCan('Payments.del');` */
export function useCan(perm: PermissionKey): boolean {
  return usePermission().can(perm);
}
