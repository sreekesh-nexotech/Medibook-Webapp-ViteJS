import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { notificationsKeys } from '@/features/ops-notifications/application/queries/notifications.keys';
import { fetchBannerImageUrl } from '@/features/ops-notifications/application/usecases/fetchBannerImageUrl';

/** Signed links last 10 minutes; re-mint well before that. */
const BANNER_IMAGE_URL_STALE_TIME_MS = 5 * 60_000;

/**
 * A signed link to show a banner's creative. Pass `null` to stay idle. A
 * file still being scanned has no link yet — the caller shows the placeholder.
 */
export function useBannerImageUrlQuery(fileId: string | null) {
  return useQuery({
    queryKey: notificationsKeys.bannerImage(fileId ?? ''),
    queryFn: async () => unwrap(await fetchBannerImageUrl(fileId ?? '')),
    enabled: fileId !== null,
    staleTime: BANNER_IMAGE_URL_STALE_TIME_MS,
    retry: false,
  });
}
