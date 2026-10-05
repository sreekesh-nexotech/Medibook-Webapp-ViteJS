import { useQuery } from '@tanstack/react-query';

import { QUERY_STALE_TIME_MS } from '@/core/config/api';
import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { fetchBanners } from '@/features/ops-notifications/application/usecases/fetchBanners';

/** Every platform campaign banner, in rotation order. */
export function useBannersQuery() {
  return useQuery({
    queryKey: notificationsKeys.banners(),
    queryFn: async () => unwrap(await fetchBanners()),
    staleTime: QUERY_STALE_TIME_MS,
  });
}
