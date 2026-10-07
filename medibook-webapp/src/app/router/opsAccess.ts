import type { OpsPermissionChecks, OpsPermissionKey } from '@/shared/hooks/useOpsPermission';

import { OPS_NAV } from '@/app/layouts/ops-nav';
import { opsPath, type OpsView } from '@/app/router/paths';

/**
 * The permission each ops screen needs: the one its main read enforces on the
 * backend (SEC-05). Notifications edits platform banners, which are platform
 * config (`settings.view`). `null` is open to every platform role.
 */
export const OPS_VIEW_PERMISSION: Readonly<Record<OpsView, OpsPermissionKey | null>> = {
  dashboard: 'dashboard.view',
  hospitals: 'hospitals.view',
  'hospital-detail': 'hospitals.view',
  onboarding: 'onboarding.view',
  compliance: 'compliance.view',
  plans: 'plans.view',
  billing: 'billing.view',
  'invoice-detail': 'billing.view',
  'payment-detail': 'billing.view',
  settlements: 'settlements.view',
  analytics: 'analytics.view',
  reports: 'reports.view',
  logs: 'logs.view',
  users: 'staff.view',
  'platform-users': 'platform_users.view',
  'platform-user-detail': 'platform_users.view',
  notifications: 'settings.view',
  settings: 'settings.view',
  account: null,
  support: 'support.view',
  'support-ticket': 'support.view',
};

export function canOpenOpsView(view: OpsView, checks: OpsPermissionChecks): boolean {
  const perm = OPS_VIEW_PERMISSION[view];
  return perm === null || checks.can(perm);
}

/** Where a platform role lands: the first screen in the sidebar it can open, else My Account. */
export function opsHomePath(checks: OpsPermissionChecks): string {
  for (const section of OPS_NAV) {
    for (const item of section.items) {
      if (canOpenOpsView(item.id, checks)) return opsPath(item.id);
    }
  }
  return opsPath('account');
}
