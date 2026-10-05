/**
 * Users & Roles entities — the hospital's staff, its pending staff invitations
 * and its four fixed system roles (`/api/v1/hospital/staff`, `/staff/invitations`,
 * `/roles`). Plain, immutable shapes; the infrastructure layer maps the API's
 * snake_case DTOs onto them.
 */

/** The four hospital roles (Q60) — there is no create, rename or delete. */
export type StaffRoleCode = 'admin' | 'receptionist' | 'accountant' | 'dept_front_desk';

export type StaffStatus = 'invited' | 'active' | 'deactivated';

export type InvitationStatus = 'invited' | 'accepted' | 'expired' | 'revoked';

export interface StaffMember {
  readonly id: string;
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly email: string | null;
  /** E.164, e.g. `+919876543210`. */
  readonly phone: string | null;
  readonly roleCode: StaffRoleCode;
  readonly roleName: string;
  readonly employeeCode: string | null;
  readonly designation: string | null;
  readonly status: StaffStatus;
  /** ISO date-time of the last sign-in, `null` when they never signed in. */
  readonly lastLoginAt: string | null;
  /** ISO date-time the sign-in lockout ends, `null` when not locked out. */
  readonly lockedUntil: string | null;
  /** Row version for `If-Match` on edits. */
  readonly version: number;
}

export interface StaffInvitation {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly roleCode: string;
  readonly status: InvitationStatus;
  readonly invitedAt: string;
  readonly lastSentAt: string;
  readonly resendCount: number;
  readonly expiresAt: string;
}

export interface StaffRole {
  readonly id: string;
  readonly code: StaffRoleCode;
  readonly name: string;
  readonly isSystem: boolean;
  /** False for `admin`, which always holds every permission. */
  readonly editable: boolean;
  /** Short permission codes, `module.action` (e.g. `appointments.view`). */
  readonly permissions: readonly string[];
}

/** One module row of a role's effective access (`GET /roles/{code}/preview`). */
export interface RolePreviewModule {
  readonly module: string;
  readonly label: string;
  readonly actions: readonly string[];
}

export interface RolePreview {
  readonly roleCode: string;
  readonly roleName: string;
  readonly modules: readonly RolePreviewModule[];
}

/** What an administrator fills in to invite a new staff member. */
export interface StaffInviteDraft {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  /** E.164, or `null` when no phone was given. */
  readonly phone: string | null;
  readonly roleCode: StaffRoleCode;
}
