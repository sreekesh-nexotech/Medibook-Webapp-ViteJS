import { useLocation } from 'react-router-dom';

import { moduleForView } from '@/app/layouts/hospital-nav';
import { hospitalViewFromPath } from '@/app/router/paths';
import { RequirePermission } from '@/app/router/RequirePermission';

/**
 * Wrapper for the hospital views that used to be admin-only (`settlements`,
 * `doctors`, `users`, `reports`, `settings`, `slots`, `profile`, `services`,
 * `messaging`, `audit`, `billing`).
 *
 * Kept under the original export name so the route tree is unaffected. The
 * gate is now the signed-in user's real permission for the view's module
 * (e.g. Settlements needs `Billing & Settlements.view`) — the same check the
 * backend applies — so an accountant reaches Settlements and Reports, and a
 * role without the permission gets `ForbiddenScreen` naming what is missing.
 */
export function RequireAdmin() {
  const { pathname } = useLocation();
  const module = moduleForView(hospitalViewFromPath(pathname));
  if (module === undefined) {
    return <RequirePermission requireAdminRole roleLabel="Administrator" />;
  }
  return <RequirePermission perm={`${module}.view`} />;
}
