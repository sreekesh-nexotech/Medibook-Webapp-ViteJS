/**
 * Auth entities. Plain readonly types — no React, no Axios, no Zod.
 */

/** The two staff surfaces: the hospital app and the operations console. */
export type AuthSurface = 'hospital' | 'platform';

/** Hospital roles (backend `RoleCodeEnum`, exactly four — Q60). */
export type HospitalRoleCode = 'admin' | 'receptionist' | 'accountant' | 'dept_front_desk';

/** Hospital lifecycle (backend `Hospital.Status`). */
export type HospitalStatus = 'draft' | 'onboarding' | 'active' | 'suspended' | 'closed';

export interface StaffUser {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly email: string;
  readonly locale: string;
  readonly timezone: string;
  /** Row version, sent as `If-Match` when the user edits their name. */
  readonly version: number;
}

export interface StaffRole {
  readonly code: string;
  readonly name: string;
}

/** A front-desk counter (`HospitalCounter`). */
export interface StaffCounter {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** A signed-in hospital staff member, as `GET /hospital/me` describes them. */
export interface HospitalSession {
  readonly surface: 'hospital';
  readonly user: StaffUser;
  /** The staff row's id — how cash sessions and payment lines name their owner. */
  readonly staffId: string;
  /** The counter this staff member works by default, if one is assigned. */
  readonly defaultCounter: StaffCounter | null;
  readonly role: StaffRole;
  /** Short permission codes, e.g. `appointments.view`. */
  readonly permissions: readonly string[];
  readonly hospital: {
    readonly id: string;
    readonly name: string;
    readonly status: HospitalStatus;
    /** Subscription lapsed: reads work, writes are refused (D-30). */
    readonly readOnly: boolean;
  };
}

/** A signed-in operations staff member, as `GET /platform/me` describes them. */
export interface PlatformSession {
  readonly surface: 'platform';
  readonly user: StaffUser;
  readonly role: StaffRole;
  readonly permissions: readonly string[];
}

export type StaffSession = HospitalSession | PlatformSession;

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
  /** Keep the refresh token after the browser closes ("Remember me"). */
  readonly remember: boolean;
}

/** What an emailed invitation link opens on (`GET /hospital/auth/invitations/{token}`). */
export interface InvitationPreview {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly hospitalName: string;
  readonly roleName: string;
  readonly expiresAt: string;
  /** The email already has a Medibook account (its password is replaced on accept). */
  readonly accountExists: boolean;
}

export interface InvitationAcceptance {
  readonly password: string;
  readonly firstName?: string;
  readonly lastName?: string;
}
