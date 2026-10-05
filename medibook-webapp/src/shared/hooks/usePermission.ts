import { useMemo } from 'react';

import { activeSurface } from '@/core/api/surface';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type ModulePerms,
  type PermAction,
  type PermsGrid,
  type RbacModule,
} from '@/features/users-roles/application/store/rbac.types';

/**
 * The single place a screen asks "may this user do X?" (audit 2.4 / X-01 /
 * Q-03). It reads the signed-in staff member's **real** permissions from
 * `GET /hospital/me` — the same set the backend enforces on every request —
 * so the UI hides exactly what the server would refuse.
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
 * Each module maps 1:1 onto a backend module code (`MODULE_CODE` below; the
 * labels are the backend's own, `core/seeds/v1.py`). Read actions map to
 * `view`, create to `add`, update/state-change to `edit`, and
 * destructive/irreversible actions to `del`. There is no fifth action.
 */

/** Every valid permission key: `"<Module>.<action>"`. */
export type PermissionKey = `${RbacModule}.${PermAction}`;

/** Build a key from its parts (handy when the module comes from a data table). */
export function permissionKey(module: RbacModule, action: PermAction): PermissionKey {
  return `${module}.${action}`;
}

/** Backend module code behind each grid module (`hospital:<code>.<action>`). */
const MODULE_CODE: Readonly<Record<RbacModule, string>> = {
  Dashboard: 'dashboard',
  Appointments: 'appointments',
  Patients: 'patients',
  'Token Management': 'token_management',
  Payments: 'payments',
  'Billing & Settlements': 'billing_settlements',
  'Doctors & Departments': 'doctors_departments',
  Reports: 'reports',
  'Hospital Settings': 'hospital_settings',
  'Users & Roles': 'users_roles',
};

/** Build the module × action grid from the backend's short codes (`appointments.view`). */
function toGrid(codes: readonly string[]): PermsGrid {
  const held = new Set(codes);
  const row = (module: RbacModule): ModulePerms => ({
    view: held.has(`${MODULE_CODE[module]}.view`),
    add: held.has(`${MODULE_CODE[module]}.add`),
    edit: held.has(`${MODULE_CODE[module]}.edit`),
    del: held.has(`${MODULE_CODE[module]}.del`),
  });
  return {
    Dashboard: row('Dashboard'),
    Appointments: row('Appointments'),
    Patients: row('Patients'),
    'Token Management': row('Token Management'),
    Payments: row('Payments'),
    'Billing & Settlements': row('Billing & Settlements'),
    'Doctors & Departments': row('Doctors & Departments'),
    Reports: row('Reports'),
    'Hospital Settings': row('Hospital Settings'),
    'Users & Roles': row('Users & Roles'),
  };
}

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
  /** The signed-in hospital role's code (`admin`, `receptionist`, …), if any. */
  roleId: string | null;
  roleName: string | null;
  /** The whole grid, for screens that render a permission summary. */
  perms: PermsGrid | null;
}

export function usePermission(): UsePermissionResult {
  // The ops console is not governed by hospital RBAC; its routes are gated by
  // `OpsGuard`, so there is no hospital session to read there.
  const isHospital = activeSurface() === 'hospital';
  const { data: session } = useSessionQuery('hospital', isHospital);
  const hospitalSession = isHospital && session?.surface === 'hospital' ? session : null;

  return useMemo<UsePermissionResult>(() => {
    // No hospital session (the ops console): fall back to "allowed", because
    // the route guards — not this hook — decide who reaches the console. A
    // hospital screen never renders before its guard has the session.
    const perms = hospitalSession ? toGrid(hospitalSession.permissions) : null;
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
      roleId: hospitalSession?.role.code ?? null,
      roleName: hospitalSession?.role.name ?? null,
      perms,
    };
  }, [hospitalSession]);
}

/** One-liner for a single check: `const mayRefund = useCan('Payments.del');` */
export function useCan(perm: PermissionKey): boolean {
  return usePermission().can(perm);
}
