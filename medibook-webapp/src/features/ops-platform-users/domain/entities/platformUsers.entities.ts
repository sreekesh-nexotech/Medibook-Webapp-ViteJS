/**
 * Patient accounts as the ops console sees them (`GET /platform/users*`,
 * `platform/services/users_admin.py`). Contact fields arrive masked unless the
 * caller holds `platform_users.edit`. Medical documents, insurance and
 * medical profile fields are never returned to the platform.
 */

/** Backend `User.Status`. */
export const PLATFORM_USER_STATUSES = ['active', 'blocked', 'pending_deletion', 'deleted'] as const;
export type PlatformUserStatus = (typeof PLATFORM_USER_STATUSES)[number];

/** Server-side sort for the accounts list — the only sortable column is registration. */
export type PlatformUserSort = 'created_at' | '-created_at';

/** Filters, sort and page for `GET /platform/users`. */
export interface PlatformUserListParams {
  /** Matches email or phone (the backend searches nothing else). */
  readonly q: string;
  readonly statuses: readonly PlatformUserStatus[];
  readonly sort: PlatformUserSort | null;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

/** One patient account row. */
export interface PlatformUserSummary {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly alternatePhone: string | null;
  readonly email: string | null;
  readonly status: PlatformUserStatus;
  readonly blockedReason: string | null;
  readonly deletionRequestedAt: string | null;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

/** A person the account books for (the account holder is `isSelf`). */
export interface PlatformUserPerson {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly relation: string;
  readonly isSelf: boolean;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
}

/** One of the account's latest bookings. */
export interface PlatformUserBooking {
  readonly id: string;
  readonly bookingRef: string;
  readonly hospitalName: string;
  readonly doctorName: string;
  readonly scheduledStartAt: string;
  readonly status: string;
  readonly source: string;
}

/** A device the patient app is installed on. */
export interface PlatformUserDevice {
  readonly id: string;
  readonly platform: string;
  readonly appVersion: string | null;
  readonly osVersion: string | null;
  readonly isActive: boolean;
  readonly lastSeenAt: string | null;
}

/** The full account: profile, persons, latest bookings, devices. */
export interface PlatformUserDetail extends PlatformUserSummary {
  readonly phoneVerifiedAt: string | null;
  readonly emailVerifiedAt: string | null;
  readonly hasPassword: boolean;
  /** Set while sign-in is locked after failed attempts. */
  readonly lockedUntil: string | null;
  readonly persons: readonly PlatformUserPerson[];
  readonly bookings: readonly PlatformUserBooking[];
  readonly devices: readonly PlatformUserDevice[];
  readonly activeSessions: number;
}
