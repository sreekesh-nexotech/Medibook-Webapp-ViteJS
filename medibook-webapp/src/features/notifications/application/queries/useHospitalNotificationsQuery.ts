import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  NOTIFICATIONS_REFETCH_INTERVAL_MS,
  notificationsKeys,
} from '@/features/notifications/application/queries/notifications.keys';
import { fetchHospitalNotifications } from '@/features/notifications/application/usecases/fetchHospitalNotifications';

/**
 * The bell's server feed (DASH-03). `data === null` means the backend keeps
 * no notification state (older build): the shell falls back to its own bell.
 */
export function useHospitalNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationsKeys.feed(),
    queryFn: async () => unwrap(await fetchHospitalNotifications()),
    refetchInterval: NOTIFICATIONS_REFETCH_INTERVAL_MS,
    enabled,
  });
}
