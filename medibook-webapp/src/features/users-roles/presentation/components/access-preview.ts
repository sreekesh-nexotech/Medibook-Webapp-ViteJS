import { permissionKey, type PermissionKey } from '@/shared/hooks/usePermission';
import type { IconName } from '@/shared/ui/icon-registry';

import { NAV_MODEL, NAV_PERMISSION_MODULE, type HospitalNavView } from '@/app/layouts/hospital-nav';
import { HOSPITAL_ROLES, type HospitalRole } from '@/app/router/paths';

import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type PermAction,
  type PermsGrid,
  type RbacModule,
  type Role,
} from '@/features/users-roles/application/store/rbac.types';

/**
 * The data behind the "View as role" access preview — audit 2.4 / X-01 / Q-03:
 * "Permissions can be ticked, but no screen ever looks different for a limited
 * role, so the client cannot validate what a receptionist or an accountant
 * would actually see."
 *
 * Every answer here is computed from the **same two gates the real shell
 * applies**, so the preview cannot drift from what the app does:
 *
 *  1. the per-item `roles` list in `NAV_MODEL` (the URL-role gate that
 *     `HospitalSidebar` and `RequireAdmin` / `RequirePermission` enforce), and
 *  2. `NAV_PERMISSION_MODULE[item] → perms[module].view`, which is exactly the
 *     check `HospitalSidebar` runs through `usePermission().canViewModule`.
 *
 * Nothing is hard-coded per role, so a permission ticked in the grid changes
 * the preview on the same render.
 */

/** Why a role cannot reach a screen. */
export type DenialReason =
  /** Its module's `view` flag is off in the permission grid. */
  | 'permission'
  /** The screen is gated to another sign-in role in `NAV_MODEL`. */
  | 'role';

export interface PreviewNavItem {
  readonly id: HospitalNavView;
  readonly label: string;
  readonly icon: IconName;
  /** The RBAC module gating the screen — `null` for ungated items (Help). */
  readonly module: RbacModule | null;
  readonly visible: boolean;
  /** Set only when `visible` is false. */
  readonly reason: DenialReason | null;
  /** The permission key a denial-by-permission would need. */
  readonly needs: PermissionKey | null;
  /** Actions the role holds on this screen's module, in grid order. */
  readonly actions: readonly PermAction[];
}

export interface PreviewSection {
  readonly section: string;
  readonly items: readonly PreviewNavItem[];
}

export interface ModuleActions {
  readonly module: RbacModule;
  readonly actions: readonly PermAction[];
}

export interface RoleAccessPreview {
  /** Every nav section with its items, each flagged visible or denied. */
  readonly sections: readonly PreviewSection[];
  /** The sidebar this role actually gets (sections with at least one item). */
  readonly navSections: readonly PreviewSection[];
  readonly visible: readonly PreviewNavItem[];
  readonly denied: readonly PreviewNavItem[];
  /** Modules with at least one granted action, for the "actions" column. */
  readonly moduleActions: readonly ModuleActions[];
  /** True when the role cannot open a single screen — a useless role. */
  readonly isLockedOut: boolean;
}

/** Human label for a grid action, matching the permission-grid column heads. */
export const ACTION_LABEL: Readonly<Record<PermAction, string>> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  del: 'Delete',
};

/** The actions a grid grants on one module, in grid column order. */
export function grantedActions(perms: PermsGrid, module: RbacModule): readonly PermAction[] {
  return PERM_ACTIONS.filter((a) => perms[module][a]);
}

/**
 * Which sign-in the preview opens on: the one that shows the most of what the
 * role's grid actually allows, ties going to the front desk.
 *
 * `HOSPITAL_ROLES` has only `receptionist` and `admin`, so a role such as
 * `Accountant` — whose grid grants Billing & Settlements and Reports, both of
 * which are admin-only screens — can only exercise its permissions at the
 * administrator sign-in. Defaulting by visible-screen count shows what the
 * permissions intend, while the denials still name every screen the URL-role
 * gate blocks.
 */
export function defaultSignInAs(role: Role): HospitalRole {
  let best: HospitalRole = 'receptionist';
  let bestCount = -1;
  for (const candidate of HOSPITAL_ROLES) {
    const count = buildRoleAccessPreview(role.perms, candidate).visible.length;
    // Strictly greater, so an equal count keeps the front-desk default.
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Build the whole preview for one grid, as seen from one sign-in role. */
export function buildRoleAccessPreview(
  perms: PermsGrid,
  signInAs: HospitalRole,
): RoleAccessPreview {
  const sections: PreviewSection[] = NAV_MODEL.map((s) => ({
    section: s.section,
    items: s.items.map((item): PreviewNavItem => {
      const module = NAV_PERMISSION_MODULE[item.id] ?? null;
      const roleAllowed = item.roles.includes(signInAs);
      const permAllowed = module === null || perms[module].view;
      let reason: DenialReason | null = null;
      if (!permAllowed) reason = 'permission';
      else if (!roleAllowed) reason = 'role';
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        module,
        visible: reason === null,
        reason,
        needs: module === null ? null : permissionKey(module, 'view'),
        actions: module === null ? [] : grantedActions(perms, module),
      };
    }),
  }));

  const all = sections.flatMap((s) => s.items);
  return {
    sections,
    navSections: sections
      .map((s) => ({ section: s.section, items: s.items.filter((i) => i.visible) }))
      .filter((s) => s.items.length > 0),
    visible: all.filter((i) => i.visible),
    denied: all.filter((i) => !i.visible),
    moduleActions: RBAC_MODULES.map((module) => ({
      module,
      actions: grantedActions(perms, module),
    })).filter((m) => m.actions.length > 0),
    isLockedOut: all.every((i) => !i.visible),
  };
}
