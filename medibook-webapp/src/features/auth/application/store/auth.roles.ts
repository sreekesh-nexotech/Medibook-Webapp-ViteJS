import type {
  HospitalSession,
  PlatformSession,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';

/** The two hospital shells the URL's `:role` segment selects (`HOSPITAL_ROLES` in the router). */
export type HospitalUrlRole = 'admin' | 'receptionist';

/**
 * The URL role a hospital session lands on. The backend has four hospital
 * roles; the app's URL has two shells. Admins get the admin shell, every other
 * role the front-desk shell — what each one may open inside it is decided by
 * its real permissions (`usePermission`), not by the URL.
 */
export function hospitalUrlRole(roleCode: string): HospitalUrlRole {
  return roleCode === 'admin' ? 'admin' : 'receptionist';
}

/** The session if it is a hospital one. */
export function hospitalSessionOf(session: StaffSession | undefined): HospitalSession | null {
  return session?.surface === 'hospital' ? session : null;
}

/** The session if it is an operations one. */
export function platformSessionOf(session: StaffSession | undefined): PlatformSession | null {
  return session?.surface === 'platform' ? session : null;
}
