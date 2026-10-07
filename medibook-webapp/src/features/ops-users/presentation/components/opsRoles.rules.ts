/**
 * Platform role ceilings, as the backend enforces them (B2, WP-02 / M-07,
 * L-18): an actor may only grant permissions it holds itself, may not act on
 * a member whose role reaches further than its own, may not change its own
 * role, and the owner role's grid is fixed. The console offers only what the
 * server would accept, so these checks decide what is shown.
 */
import type {
  OpsStaffMember,
  OpsStaffRole,
} from '@/features/ops-users/domain/entities/opsUsers.types';

/** The seeded role whose grid nobody may change (B2: owner grid immutable). */
export const OWNER_ROLE_CODE = 'owner';

/** Role codes the backend accepts: lowercase start, then letters, digits, underscores (2–41). */
const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;

/** Codes in `wanted` that the actor does not hold (what a 403 would list in `meta.missing`). */
export function missingPermissions(
  wanted: readonly string[],
  held: ReadonlySet<string>,
): readonly string[] {
  return wanted.filter((c) => !held.has(c)).sort();
}

/** Whether the actor may hand out `role` (assign it, or edit a member on it). */
export function withinCeiling(role: OpsStaffRole, held: ReadonlySet<string>): boolean {
  return missingPermissions(role.permissions, held).length === 0;
}

/** Roles the actor may assign: every permission of the role is one it holds. */
export function assignableRoles(
  roles: readonly OpsStaffRole[],
  held: ReadonlySet<string>,
): readonly OpsStaffRole[] {
  return roles.filter((r) => withinCeiling(r, held));
}

/**
 * Whether the actor may change, deactivate or reactivate `member`: never
 * themselves (409 "own role"), and only members whose role is within their
 * own grid (403 otherwise).
 */
export function canManageMember(
  member: OpsStaffMember,
  roles: readonly OpsStaffRole[],
  held: ReadonlySet<string>,
  selfUserId: string | null,
): boolean {
  if (member.userId === selfUserId) return false;
  const role = roles.find((r) => r.id === member.role.id);
  return role !== undefined && withinCeiling(role, held);
}

/** The owner role's grid is fixed; it may only be renamed. */
export function isGridLocked(role: OpsStaffRole): boolean {
  return role.code === OWNER_ROLE_CODE;
}

/** Why `code` cannot be a new role's code, or `null`. */
export function roleCodeError(code: string, existing: readonly OpsStaffRole[]): string | null {
  const c = code.trim();
  if (!ROLE_CODE_PATTERN.test(c)) {
    return 'Use 2–41 lowercase letters, digits or underscores, starting with a letter.';
  }
  return existing.some((r) => r.code === c) ? 'A role with this code exists.' : null;
}

/** A suggested code for a role name: "Finance Lead" → "finance_lead". */
export function suggestRoleCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '');
  return slug.slice(0, 41);
}

/** Toggle one permission code in a grid, keeping it sorted. */
export function toggleGrant(grid: readonly string[], code: string, on: boolean): string[] {
  const next = new Set(grid);
  if (on) next.add(code);
  else next.delete(code);
  return [...next].sort();
}
