import { Outlet, useLocation } from 'react-router-dom';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { ForbiddenScreen } from '@/app/layouts/ForbiddenScreen';
import { OPS_VIEW_PERMISSION, canOpenOpsView } from '@/app/router/opsAccess';
import { opsViewFromPath } from '@/app/router/paths';

/**
 * One guard for every ops route (SEC-05): the screen at this URL opens only
 * for a platform role holding its permission; any other role sees why not.
 */
export function RequireOpsView() {
  const { pathname } = useLocation();
  const checks = useOpsPermission();
  const view = opsViewFromPath(pathname);
  if (canOpenOpsView(view, checks)) return <Outlet />;
  return <ForbiddenScreen requiredPermission={OPS_VIEW_PERMISSION[view] ?? undefined} />;
}
