import { RequirePermission } from '@/app/router/RequirePermission';

/**
 * Wrapper for admin-only hospital views (`settlements`, `doctors`, `users`,
 * `reports`, `settings`, plus the new `slots` / `profile` / `services` /
 * `messaging` / `audit` / `billing`).
 *
 * Kept under the original export name so the route tree and anything else
 * importing it are unaffected — it is now a thin call into the
 * permission-aware `RequirePermission`, which renders `ForbiddenScreen`
 * instead of silently bouncing a receptionist to their dashboard (audit 3.7).
 */
export function RequireAdmin() {
  return <RequirePermission requireAdminRole roleLabel="Administrator" />;
}
