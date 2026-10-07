import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsDashboardKeys } from '@/features/ops-dashboard/application/queries/opsDashboard.keys';
import { fetchOpsDashboard } from '@/features/ops-dashboard/application/usecases/fetchOpsDashboard';

/** Counts and alerts move with onboarding and dunning; a minute is fresh enough for a landing page. */
const OPS_DASHBOARD_STALE_TIME_MS = 60_000;

/**
 * The platform dashboard: KPIs, computed alerts and recent onboarding cases.
 *
 * `GET /platform/dashboard` enforces `dashboard.view`, so the read only runs
 * for a role holding it (UAT-35, 12·F1): finance, support and compliance
 * would otherwise get a 403 on every console page through the topbar bell.
 */
export function useOpsDashboardQuery() {
  const canView = useOpsPermission().can('dashboard.view');
  return useQuery({
    queryKey: opsDashboardKeys.summary(),
    queryFn: async () => unwrap(await fetchOpsDashboard()),
    staleTime: OPS_DASHBOARD_STALE_TIME_MS,
    enabled: canView,
  });
}
