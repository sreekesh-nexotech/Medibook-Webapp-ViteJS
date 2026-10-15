import { permissionKey, type PermissionKey } from '@/shared/hooks/usePermission';
import type { IconName } from '@/shared/ui/icon-registry';

import { NAV_MODEL, NAV_PERMISSION_MODULE, type HospitalNavView } from '@/app/layouts/hospital-nav';

import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type PermAction,
  type PermsGrid,
  type RbacModule,
} from '@/features/users-roles/application/store/rbac.types';

/**
 * The data behind the "View as role" access preview — audit 2.4 / X-01 / Q-03:
 * "Permissions can be ticked, but no screen ever looks different for a limited
 * role, so the client cannot validate what a receptionist or an accountant
 * would actually see."
 *
 * The app has one gate per screen — the role's own permission for the
 * screen's module (`NAV_PERMISSION_MODULE[item] → perms[module].view`), the
 * same check `HospitalSidebar` runs through `usePermission().canViewModule`
 * and `RequireAdmin` runs on the route. There is no sign-in role gate any more
 * (UAT-23): an accountant reaches Billing & Settlements and Reports because it
 * holds their view permission. Screens no module gates (Help & Support) are
 * open to every staff member.
 *
 * Nothing is hard-coded per role, so a permission ticked in the grid changes
 * the preview on the same render.
 */

export interface PreviewNavItem {
  readonly id: HospitalNavView;
  readonly label: string;
  readonly icon: IconName;
  /** The RBAC module gating the screen — `null` for ungated items (Help). */
  readonly module: RbacModule | null;
  readonly visible: boolean;
  /** The permission key a refused screen needs; `null` when visible or ungated. */
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
  /** True when the role reaches no module-gated screen at all — a useless role. */
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

/** Build the whole preview for one permission grid. */
export function buildRoleAccessPreview(perms: PermsGrid): RoleAccessPreview {
  const sections: PreviewSection[] = NAV_MODEL.map((s) => ({
    section: s.section,
    items: s.items.map((item): PreviewNavItem => {
      const module = NAV_PERMISSION_MODULE[item.id] ?? null;
      const visible = module === null || perms[module].view;
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        module,
        visible,
        needs: visible || module === null ? null : permissionKey(module, 'view'),
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
    isLockedOut: all.every((i) => i.module === null || !i.visible),
  };
}
