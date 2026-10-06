import { useMemo } from 'react';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { platformSessionOf } from '@/features/auth/application/store/auth.roles';
import type { PermAction } from '@/features/users-roles/application/store/rbac.types';

/**
 * The ops console's own permission checks (SEC-05). Platform staff hold
 * `<module>.<action>` codes from their role (backend `core/seeds/v1.py`
 * `PLATFORM_MODULES` and `PLATFORM_ROLES`: owner, operations manager,
 * finance, support, compliance, read only), and every platform endpoint
 * enforces one of them. Screens and actions ask here, so the console offers
 * exactly what the server would allow.
 */

export const PLATFORM_MODULES = [
  'dashboard',
  'hospitals',
  'onboarding',
  'plans',
  'billing',
  'settlements',
  'analytics',
  'reports',
  'logs',
  'compliance',
  'platform_users',
  'staff',
  'notifications',
  'settings',
  'support',
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

/** A platform permission code, e.g. `'billing.edit'`. */
export type OpsPermissionKey = `${PlatformModule}.${PermAction}`;

export interface OpsPermissionChecks {
  can: (key: OpsPermissionKey) => boolean;
  canAny: (...keys: readonly OpsPermissionKey[]) => boolean;
  canAll: (...keys: readonly OpsPermissionKey[]) => boolean;
}

/** Checks for a platform session's codes; `null` (no platform session) allows nothing. */
export function opsPermissionChecks(codes: readonly string[] | null): OpsPermissionChecks {
  const held = new Set(codes ?? []);
  const can = (key: OpsPermissionKey): boolean => held.has(key);
  return {
    can,
    canAny: (...keys) => keys.some(can),
    canAll: (...keys) => keys.every(can),
  };
}

export function useOpsPermission(): OpsPermissionChecks {
  const { data } = useSessionQuery('platform');
  const session = platformSessionOf(data);
  return useMemo(() => opsPermissionChecks(session?.permissions ?? null), [session]);
}
