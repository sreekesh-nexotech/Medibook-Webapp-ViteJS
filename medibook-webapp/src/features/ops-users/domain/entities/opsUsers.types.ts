/**
 * Internal Medibook staff, platform roles and the permission catalogue, as
 * the ops console's Users & Roles screen works with them
 * (`/api/v1/platform/staff`, `/roles`, `/permissions`).
 */

/** Membership state: invited (no password yet), active, or deactivated. */
export type OpsStaffStatus = 'invited' | 'active' | 'deactivated';

/** The role a staff member holds, as the staff list embeds it. */
export interface OpsStaffRoleRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** One internal Medibook staff member. */
export interface OpsStaffMember {
  readonly id: string;
  readonly userId: string;
  /** First and last name joined, for display and search. */
  readonly name: string;
  readonly email: string;
  /** Last successful sign-in, or null if they never signed in. */
  readonly lastLoginAt: string | null;
  readonly role: OpsStaffRoleRef;
  readonly status: OpsStaffStatus;
  /** Set while sign-in is locked after failed attempts. */
  readonly lockedUntil: string | null;
  /** Row version, sent back as `If-Match` on edits. */
  readonly version: number;
}

/** A platform role and the permission codes (`hospitals.view`, …) it grants. */
export interface OpsStaffRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Seeded roles; these cannot be deleted. */
  readonly isSystem: boolean;
  readonly permissions: readonly string[];
  readonly version: number;
}

/** One entry of the platform permission catalogue. */
export interface OpsPermission {
  /** Short code, e.g. `hospitals.view`. */
  readonly code: string;
  /** Module code, e.g. `hospitals`. */
  readonly module: string;
  /** `view` | `add` | `edit` | `del`. */
  readonly action: string;
  /** Module display name, e.g. `Hospitals`. */
  readonly moduleLabel: string;
}

/** Add User payload: the invitee and the role they start on. */
export interface OpsStaffInvite {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly roleId: string;
}

/** A new platform role: a unique code, a display name and its permission grid. */
export interface OpsRoleDraft {
  /** Lowercase letters, digits and underscores, 2–41 characters. */
  readonly code: string;
  readonly name: string;
  readonly permissions: readonly string[];
}

/** An edit of a role: rename and/or replace its grid. */
export interface OpsRoleChanges {
  readonly name?: string;
  readonly permissions?: readonly string[];
}
