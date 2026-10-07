import { isFailure } from '@/core/error/failure';

import { fmtDate } from '@/shared/lib/format';

import {
  PERM_ACTIONS,
  RBAC_MODULES,
  type ModulePerms,
  type PermsGrid,
  type RbacModule,
  type Role,
} from '@/features/users-roles/application/store/rbac.types';
import type {
  PermissionModule,
  RolePreviewModule,
  StaffInvitation,
  StaffMember,
  StaffRole,
  StaffRoleCode,
} from '@/features/users-roles/domain/entities/usersRoles.types';

/**
 * Adapters between the Users & Roles API entities and the view shapes the
 * screen's components already render (`Role` + its module × action
 * `PermsGrid`, and one table row per person). Pure functions — no fetching.
 */

/* ------------------------------------------------------------------ roles */

/**
 * The backend has no role colour, so the screen's dot colour is presentation
 * copy keyed by the four fixed role codes; so is the one-line summary used
 * until the backend's own `description` (USR-02) arrives. Colours are
 * `@theme` tokens, applied through `style` because they are chosen per row.
 */
const ROLE_PRESENTATION: Readonly<Record<StaffRoleCode, { color: string; desc: string }>> = {
  admin: {
    color: 'var(--color-y-600)',
    desc: 'Full access to every module, settings and finance.',
  },
  receptionist: {
    color: 'var(--color-blue)',
    desc: 'Front desk — books walk-ins, records payments, issues tokens.',
  },
  accountant: { color: 'var(--color-g-600)', desc: 'Payments, settlements and financial reports.' },
  dept_front_desk: {
    color: 'var(--color-p-500)',
    desc: "Manages a department's live token queue and its appointments.",
  },
};

/**
 * Backend module code behind each grid row (`core/seeds/v1.py`
 * `HOSPITAL_MODULES`). Mirrors the private map in `usePermission`.
 */
const GRID_MODULE_CODE: Readonly<Record<RbacModule, string>> = {
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

const GRID_MODULE_CODES: ReadonlySet<string> = new Set(Object.values(GRID_MODULE_CODE));

/** A role as the screen renders it, plus what saving its grid needs. */
export interface RoleView extends Role {
  readonly code: StaffRoleCode;
  readonly editable: boolean;
  /** The role's full permission set as the server holds it, grid or not. */
  readonly permissionCodes: readonly string[];
  /** The backend's own description (USR-02); `null` when it has none. */
  readonly description: string | null;
  /** Row version for `If-Match` (USR-02); `null` on an older backend. */
  readonly version: number | null;
}

function moduleOf(code: string): string {
  const at = code.lastIndexOf('.');
  return at < 0 ? code : code.slice(0, at);
}

function gridFrom(has: (moduleCode: string, action: string) => boolean): PermsGrid {
  const row = (module: RbacModule): ModulePerms => ({
    view: has(GRID_MODULE_CODE[module], 'view'),
    add: has(GRID_MODULE_CODE[module], 'add'),
    edit: has(GRID_MODULE_CODE[module], 'edit'),
    del: has(GRID_MODULE_CODE[module], 'del'),
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

/** Short permission codes (`appointments.view`) → the ten-module grid. */
export function toPermsGrid(codes: readonly string[]): PermsGrid {
  const held = new Set(codes);
  return gridFrom((m, a) => held.has(`${m}.${a}`));
}

/** `GET /roles/{code}/preview` modules → the ten-module grid. */
export function previewToPermsGrid(modules: readonly RolePreviewModule[]): PermsGrid {
  const byModule = new Map(modules.map((m) => [m.module, new Set(m.actions)] as const));
  return gridFrom((m, a) => byModule.get(m)?.has(a) ?? false);
}

/**
 * The permission set to send when a role's grid is saved. `PATCH
 * /roles/{code}/permissions` **replaces** the whole set, and the backend
 * catalogue has modules the ten-row grid does not show (`patient_approvals`,
 * `cash_desk`, `display_devices`). Codes for those are carried over from the
 * role's current set unchanged, so saving the grid never silently strips them.
 */
export function gridToPermissionCodes(grid: PermsGrid, current: readonly string[]): string[] {
  const kept = current.filter((c) => !GRID_MODULE_CODES.has(moduleOf(c)));
  const granted = RBAC_MODULES.flatMap((module) =>
    PERM_ACTIONS.filter((a) => grid[module][a]).map((a) => `${GRID_MODULE_CODE[module]}.${a}`),
  );
  return [...kept, ...granted].sort();
}

/**
 * The role's codes for the modules outside the ten-row grid (`cash_desk.view`,
 * …). Read from the role itself, never from the catalogue, so a catalogue
 * that loads late (or fails) cannot make Save drop them (UAT-22).
 */
export function nonGridCodes(codes: readonly string[]): string[] {
  return codes.filter((c) => !GRID_MODULE_CODES.has(moduleOf(c)));
}

/** What a set of codes grants on each module outside the grid, labelled from the catalogue. */
export function extraModuleAccess(
  catalogue: readonly PermissionModule[],
  codes: readonly string[],
): readonly { readonly module: string; readonly label: string; readonly actions: string[] }[] {
  const held = new Set(codes);
  return extraPermissionModules(catalogue).map((m) => ({
    module: m.module,
    label: m.label,
    actions: m.actions.filter((a) => held.has(`${m.module}.${a}`)),
  }));
}

/** The preview's modules outside the grid (Cash Desk, …), as the server labels them. */
export function previewExtraModules(
  modules: readonly RolePreviewModule[],
): readonly RolePreviewModule[] {
  return modules.filter((m) => !GRID_MODULE_CODES.has(m.module));
}

/**
 * Catalogue modules the ten-row grid does not have (on the test backend:
 * Cash Desk, Patient Approvals, Display Devices). The role editor lists them
 * under the grid so they can be seen and changed, not only carried over.
 */
export function extraPermissionModules(
  catalogue: readonly PermissionModule[],
): readonly PermissionModule[] {
  return catalogue.filter((m) => !GRID_MODULE_CODES.has(m.module));
}

/**
 * How many modules a permission set touches. Without the catalogue only the
 * grid's ten are counted, so the card never reads "13/10" (08 F9).
 */
export function modulesHeld(codes: readonly string[], gridOnly = false): number {
  const modules = new Set(codes.map(moduleOf));
  if (!gridOnly) return modules.size;
  return [...modules].filter((m) => GRID_MODULE_CODES.has(m)).length;
}

export function toRoleView(role: StaffRole): RoleView {
  const look = ROLE_PRESENTATION[role.code];
  return {
    id: role.code,
    code: role.code,
    name: role.name,
    color: look.color,
    desc: role.description ?? look.desc,
    description: role.description,
    version: role.version,
    system: !role.editable,
    editable: role.editable,
    perms: toPermsGrid(role.permissions),
    permissionCodes: role.permissions,
  };
}

/* ------------------------------------------------------------------- users */

export type UserRowStatus = 'Active' | 'Inactive' | 'Pending' | 'Expired';

/** One row of the Users table — a staff member, or an invitation not yet accepted. */
export interface UserRow {
  /** Unique across both kinds (a staff id and an invitation id never share a key). */
  readonly key: string;
  readonly kind: 'staff' | 'invitation';
  /** Staff id or invitation id, per `kind`. */
  readonly id: string;
  /** The staff member's user id (to know the signed-in user's own row); `null` for invitations. */
  readonly userId: string | null;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** Staff sign in with their email — the hospital's own ID for them, if set. */
  readonly employeeCode: string | null;
  readonly designation: string | null;
  /** Default counter id (staff only). */
  readonly counterId: string | null;
  /** The role code — `RoleView.id`. */
  readonly roleId: string;
  readonly status: UserRowStatus;
  /** ISO date-time of the last sign-in, `null` for never. */
  readonly lastLoginAt: string | null;
  readonly invite: 'Accepted' | 'Pending';
  /** ISO date-time the sign-in lockout ends, `null` when not locked. */
  readonly lockedUntil: string | null;
  /** Row version for the role-change `If-Match` (0 for invitations, which have none). */
  readonly version: number;
  /** Staff: joined and deactivated dates. */
  readonly joinedAt: string | null;
  readonly deactivatedAt: string | null;
  /** Invitations: when it was first and last sent, how often resent, when the link dies. */
  readonly invitedAt: string | null;
  readonly lastSentAt: string | null;
  readonly resendCount: number;
  readonly expiresAt: string | null;
}

/** Shown where the backend has no value (employee code, phone). */
export const NO_VALUE = '—';

const STAFF_STATUS: Readonly<Record<StaffMember['status'], UserRowStatus>> = {
  active: 'Active',
  deactivated: 'Inactive',
  invited: 'Pending',
};

function fullName(first: string, last: string | null): string {
  return [first, last ?? ''].join(' ').trim();
}

export function staffToRow(s: StaffMember): UserRow {
  return {
    key: `staff:${s.id}`,
    kind: 'staff',
    id: s.id,
    userId: s.userId,
    name: fullName(s.firstName, s.lastName),
    email: s.email ?? NO_VALUE,
    phone: s.phone ?? NO_VALUE,
    employeeCode: s.employeeCode,
    designation: s.designation,
    counterId: s.counterId,
    roleId: s.roleCode,
    status: STAFF_STATUS[s.status],
    lastLoginAt: s.lastLoginAt,
    invite: s.status === 'invited' ? 'Pending' : 'Accepted',
    lockedUntil: s.lockedUntil,
    version: s.version,
    joinedAt: s.joinedAt,
    deactivatedAt: s.deactivatedAt,
    invitedAt: null,
    lastSentAt: null,
    resendCount: 0,
    expiresAt: null,
  };
}

/**
 * Whether an invitation's link no longer works: the backend says `expired`
 * (USR-01), or — on an older backend that keeps saying `invited` — its
 * `expires_at` has passed at `now` (epoch ms).
 */
export function invitationToRow(i: StaffInvitation, now: number): UserRow {
  const expired = i.status === 'expired' || Date.parse(i.expiresAt) <= now;
  return {
    key: `invitation:${i.id}`,
    kind: 'invitation',
    id: i.id,
    userId: null,
    name: fullName(i.firstName, i.lastName),
    email: i.email,
    phone: i.phone ?? NO_VALUE,
    employeeCode: null,
    designation: null,
    counterId: null,
    roleId: i.roleCode,
    status: expired ? 'Expired' : 'Pending',
    lastLoginAt: null,
    invite: 'Pending',
    lockedUntil: null,
    version: 0,
    joinedAt: null,
    deactivatedAt: null,
    invitedAt: i.invitedAt,
    lastSentAt: i.lastSentAt,
    resendCount: i.resendCount,
    expiresAt: i.expiresAt,
  };
}

/** True while a sign-in lockout is still running at `now` (epoch ms). */
export function isLockedOut(row: UserRow, now: number): boolean {
  return row.lockedUntil !== null && Date.parse(row.lockedUntil) > now;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Past this, an exact date reads better than "N days ago". */
const RELATIVE_DAYS_MAX = 30;
const ISO_DATE_LENGTH = 10;

/** "Never", "Just now", "5 min ago", "3 h ago", "2 days ago", or the date. */
export function lastActiveLabel(iso: string | null, now: number): string {
  if (iso === null) return 'Never';
  const diff = now - Date.parse(iso);
  if (Number.isNaN(diff)) return NO_VALUE;
  if (diff < MINUTE_MS) return 'Just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days <= RELATIVE_DAYS_MAX) return days === 1 ? '1 day ago' : `${days} days ago`;
  return fmtDate(iso.slice(0, ISO_DATE_LENGTH));
}

/* ------------------------------------------------------------- invite form */

/** Country code for the 10-digit Indian mobile numbers the form accepts. */
const INDIA_DIAL_CODE = '+91';

/** A validated 10-digit Indian mobile → E.164; blank → `null`. */
export function toE164IN(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits === '' ? null : `${INDIA_DIAL_CODE}${digits}`;
}

/** "Asha Verma" → first "Asha", last "Verma"; a single word has no last name. */
export function splitFullName(name: string): { firstName: string; lastName: string | null } {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const last = rest.join(' ');
  return { firstName: first, lastName: last === '' ? null : last };
}

/* ----------------------------------------------------------------- errors */

/** True while `row` is the signed-in user's own membership (B2 refuses self role changes). */
export function isOwnRow(row: UserRow, myUserId: string | null): boolean {
  return row.kind === 'staff' && myUserId !== null && row.userId === myUserId;
}

/**
 * The user-safe sentence for a failed request: the first field message of a
 * 400 (e.g. "An invitation to this email is already pending."), else the
 * failure's own message, else `fallback`.
 */
export function failureText(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const firstField = Object.values(error.fieldErrors)[0]?.[0];
  return firstField ?? error.message;
}
