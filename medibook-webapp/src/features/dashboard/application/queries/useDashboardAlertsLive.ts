import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { WS_PUSH_REFRESH_WINDOW_MS } from '@/core/config/api';
import { useCoalescedCallback } from '@/shared/hooks/useCoalescedCallback';
import { useSocket } from '@/shared/hooks/useSocket';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';

/** WebSocket channel of the hospital's booking alerts (`routing.py`). */
const ALERTS_SOCKET_PATH = '/hospital/alerts';

/**
 * Keep the dashboard alert counts live over `ws/hospital/alerts`: a push
 * (appointment created, cancelled, confirmed or awaiting approval) refreshes
 * the dashboard queries, which the topbar bell and both dashboards read —
 * at once for a lone push, once per `WS_PUSH_REFRESH_WINDOW_MS` for a burst.
 * The queries' own polling stays as the safety net while the socket reconnects.
 */
export function useDashboardAlertsLive() {
  const queryClient = useQueryClient();
  const onFrame = useCoalescedCallback(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }, [queryClient]),
    WS_PUSH_REFRESH_WINDOW_MS,
  );
  return useSocket({ path: ALERTS_SOCKET_PATH, surface: 'hospital', onFrame });
}
