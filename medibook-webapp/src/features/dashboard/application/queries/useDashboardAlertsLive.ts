import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSocket } from '@/shared/hooks/useSocket';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';

/** WebSocket channel of the hospital's booking alerts (`routing.py`). */
const ALERTS_SOCKET_PATH = '/hospital/alerts';

/**
 * Keep the dashboard alert counts live over `ws/hospital/alerts`: every push
 * (appointment created, cancelled, confirmed or awaiting approval) refreshes
 * the dashboard queries, which the topbar bell and both dashboards read. The
 * queries' own polling stays as the safety net while the socket reconnects.
 */
export function useDashboardAlertsLive() {
  const queryClient = useQueryClient();
  const onFrame = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  }, [queryClient]);
  return useSocket({ path: ALERTS_SOCKET_PATH, surface: 'hospital', onFrame });
}
