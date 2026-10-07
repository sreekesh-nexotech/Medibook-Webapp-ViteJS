import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsDashboardKeys } from '@/features/ops-dashboard/application/queries/opsDashboard.keys';
import { fetchOpsDashboard } from '@/features/ops-dashboard/application/usecases/fetchOpsDashboard';

/** Counts and alerts move with onboarding and dunning; a minute is fresh enough for a landing page. */
const OPS_DASHBOARD_STALE_TIME_MS = 60_000;

/** The platform dashboard: KPIs, computed alerts and recent onboarding cases. */
export function useOpsDashboardQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: opsDashboardKeys.summary(),
    queryFn: async () => unwrap(await fetchOpsDashboard()),
    staleTime: OPS_DASHBOARD_STALE_TIME_MS,
  });
}
