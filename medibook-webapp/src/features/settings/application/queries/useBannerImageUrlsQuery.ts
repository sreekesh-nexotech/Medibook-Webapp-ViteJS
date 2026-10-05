import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { fetchBannerImageUrl } from '@/features/settings/application/usecases/fetchBannerImageUrl';

/** Signed links last 10 minutes; re-sign a little before they expire. */
const IMAGE_URL_STALE_TIME_MS = 8 * 60_000;

/**
 * Displayable URLs for banner images, keyed by file id. A file whose link
 * fails (still scanning, removed) is simply absent — the thumb falls back to
 * its placeholder.
 */
export function useBannerImageUrlsQuery(
  fileIds: readonly string[],
): Readonly<Record<string, string>> {
  return useQueries({
    queries: fileIds.map((fileId) => ({
      queryKey: profileKeys.bannerImageUrl(fileId),
      queryFn: async () => unwrap(await fetchBannerImageUrl(fileId)),
      staleTime: IMAGE_URL_STALE_TIME_MS,
      refetchInterval: IMAGE_URL_STALE_TIME_MS,
      retry: false,
    })),
    combine: (results) => {
      const urls: Record<string, string> = {};
      results.forEach((r, i) => {
        const id = fileIds[i];
        if (id !== undefined && r.data !== undefined) urls[id] = r.data;
      });
      return urls;
    },
  });
}
