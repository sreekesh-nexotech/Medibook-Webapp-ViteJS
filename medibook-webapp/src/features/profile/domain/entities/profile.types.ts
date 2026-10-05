/** My-account entities. Plain readonly types. */

/** One signed-in device/browser of the current user on this surface. */
export interface ActiveSession {
  readonly id: string;
  readonly userAgent: string | null;
  readonly ip: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  /** This browser. */
  readonly current: boolean;
}

export interface NameChange {
  readonly firstName: string;
  readonly lastName: string;
}

export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}
