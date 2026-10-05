import type {
  HospitalSession,
  PlatformSession,
  StaffSession,
} from '@/features/auth/domain/entities/auth.types';
import { useAuthStore } from '@/features/auth/application/store/auth.store';
import type { AuthRole } from '@/features/auth/application/store/auth.store';

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

/** The legacy auth-store role for a session (read by the shells and the audit store). */
export function authRoleFor(session: StaffSession): AuthRole {
  return session.surface === 'platform' ? 'ops' : hospitalUrlRole(session.role.code);
}

/**
 * Mirror a validated session into the legacy demo auth store, through its own
 * actions — the shells and the audit store still read `role` from it, and
 * other modules' files must not be reshaped (integration rule 2).
 */
export function syncAuthStore(session: StaffSession): void {
  const store = useAuthStore.getState();
  const role = authRoleFor(session);
  if (store.authed && store.role === role) return;
  store.login(session.surface === 'platform' ? 'ops' : 'hospital');
  store.switchRole(role);
}

/** Mark the legacy auth store signed out. */
export function clearAuthStore(): void {
  useAuthStore.getState().logout();
}

/** The session if it is a hospital one. */
export function hospitalSessionOf(session: StaffSession | undefined): HospitalSession | null {
  return session?.surface === 'hospital' ? session : null;
}

/** The session if it is an operations one. */
export function platformSessionOf(session: StaffSession | undefined): PlatformSession | null {
  return session?.surface === 'platform' ? session : null;
}
