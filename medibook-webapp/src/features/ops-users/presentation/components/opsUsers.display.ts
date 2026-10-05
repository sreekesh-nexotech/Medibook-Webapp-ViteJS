import type {
  OpsPermission,
  OpsStaffMember,
  OpsStaffRole,
  OpsStaffStatus,
} from '@/features/ops-users/domain/entities/opsUsers.types';
import { fmtDate, toLocalISO } from '@/shared/lib/format';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * Display helpers for the ops Users & Roles screen: status labels, "last
 * active" wording, and a role's access summarised per module from the
 * permission catalogue.
 */

/** Badge label per membership state (`Suspended` is the console's word for deactivated). */
export const STAFF_STATUS_LABEL: Readonly<Record<OpsStaffStatus, string>> = {
  invited: 'Pending',
  active: 'Active',
  deactivated: 'Suspended',
};

/** True while the member's sign-in is locked after failed attempts. */
export function isLocked(member: OpsStaffMember, now: number = Date.now()): boolean {
  return member.lockedUntil != null && new Date(member.lockedUntil).getTime() > now;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Beyond this, a date reads better than "n days ago". */
const RELATIVE_MAX_DAYS = 30;

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/** "Just now" / "5 mins ago" / "2 hrs ago" / "3 days ago" / "14 Jun 2026"; em dash if never. */
export function lastActiveLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const at = new Date(iso);
  const diff = Math.max(0, now - at.getTime());
  if (diff < MINUTE_MS) return 'Just now';
  if (diff < HOUR_MS) return plural(Math.floor(diff / MINUTE_MS), 'min');
  if (diff < DAY_MS) return plural(Math.floor(diff / HOUR_MS), 'hr');
  const days = Math.floor(diff / DAY_MS);
  if (days <= RELATIVE_MAX_DAYS) return plural(days, 'day');
  return fmtDate(toLocalISO(at));
}

/** The four catalogue actions, in display order. */
const ACTION_ORDER: readonly string[] = ['view', 'add', 'edit', 'del'];

const ACTION_LABEL: Readonly<Record<string, string>> = {
  view: 'view',
  add: 'add',
  edit: 'edit',
  del: 'delete',
};

/** One catalogue module and the actions it offers. */
export interface CatalogueModule {
  readonly module: string;
  readonly label: string;
  readonly actions: readonly string[];
}

/** The catalogue grouped by module, in the backend's order. */
export function catalogueModules(catalogue: readonly OpsPermission[]): readonly CatalogueModule[] {
  const byModule = new Map<string, { label: string; actions: string[] }>();
  for (const p of catalogue) {
    const entry = byModule.get(p.module) ?? { label: p.moduleLabel, actions: [] };
    entry.actions.push(p.action);
    byModule.set(p.module, entry);
  }
  return [...byModule].map(([module, { label, actions }]) => ({
    module,
    label,
    actions: ACTION_ORDER.filter((a) => actions.includes(a)),
  }));
}

/** How much of one module a role holds. */
export type ModuleAccess =
  | { readonly kind: 'full' }
  | { readonly kind: 'none' }
  | { readonly kind: 'partial'; readonly actions: readonly string[] };

export function moduleAccess(role: OpsStaffRole, module: CatalogueModule): ModuleAccess {
  const held = module.actions.filter((a) => role.permissions.includes(`${module.module}.${a}`));
  if (held.length === 0) return { kind: 'none' };
  if (held.length === module.actions.length) return { kind: 'full' };
  return { kind: 'partial', actions: held };
}

/** "view · edit" for a partial cell. */
export function actionsLabel(actions: readonly string[]): string {
  return actions.map((a) => ACTION_LABEL[a] ?? a).join(' · ');
}

/** One line of a role annotation: an access level and the modules at it. */
export interface AccessGroup {
  readonly heading: string;
  readonly modules: readonly string[];
}

/**
 * A role's access as a few readable lines — "Full access: …", "view · edit:
 * …" — plus the modules it cannot open at all.
 */
export function roleSummary(
  role: OpsStaffRole,
  modules: readonly CatalogueModule[],
): { readonly can: readonly AccessGroup[]; readonly cant: readonly string[] } {
  const groups = new Map<string, string[]>();
  const cant: string[] = [];
  for (const m of modules) {
    const access = moduleAccess(role, m);
    if (access.kind === 'none') {
      cant.push(m.label);
      continue;
    }
    const heading = access.kind === 'full' ? 'Full access' : actionsLabel(access.actions);
    groups.set(heading, [...(groups.get(heading) ?? []), m.label]);
  }
  return {
    can: [...groups].map(([heading, list]) => ({ heading, modules: list })),
    cant,
  };
}

/** KPI tile look per seeded role; custom roles share the neutral look. */
interface RoleLook {
  readonly icon: IconName;
  readonly iconClass: string;
  readonly valueClass: string;
}

const ROLE_LOOK: Readonly<Record<string, RoleLook>> = {
  owner: {
    icon: 'shield-check',
    iconClass: 'bg-blue-soft-bg text-text-navy',
    valueClass: 'text-text-navy',
  },
  ops_manager: {
    icon: 'settings',
    iconClass: 'bg-blue-soft-bg text-blue',
    valueClass: 'text-blue',
  },
  finance: { icon: 'indian-rupee', iconClass: 'bg-g-100 text-g-600', valueClass: 'text-g-600' },
  support: { icon: 'headset', iconClass: 'bg-blue-soft-bg text-blue', valueClass: 'text-blue' },
  compliance: {
    icon: 'scale',
    iconClass: 'bg-badge-noshow-bg text-orange',
    valueClass: 'text-orange',
  },
  read_only: {
    icon: 'eye',
    iconClass: 'bg-grey-300 text-text-muted',
    valueClass: 'text-text-strong',
  },
};

const CUSTOM_ROLE_LOOK: RoleLook = {
  icon: 'users',
  iconClass: 'bg-grey-300 text-text-muted',
  valueClass: 'text-text-strong',
};

export function roleLook(code: string): RoleLook {
  return ROLE_LOOK[code] ?? CUSTOM_ROLE_LOOK;
}

/** "9 of 15 modules" — how wide a role's reach is, for its KPI tile. */
export function roleReach(role: OpsStaffRole, modules: readonly CatalogueModule[]): string {
  const reached = modules.filter((m) => moduleAccess(role, m).kind !== 'none').length;
  return modules.length ? `Access to ${reached} of ${modules.length} modules` : '—';
}
