import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { fetchHospitalImageUrl } from '@/features/settings/application/usecases/fetchHospitalImageUrl';

/** Signed links last 10 minutes; re-sign a little before they expire. */
const IMAGE_URL_STALE_TIME_MS = 8 * 60_000;

/** A displayable URL for a stored hospital image. Pass `null` to stay idle. */
export function useHospitalImageUrlQuery(fileId: string | null) {
  return useQuery({
    queryKey: settingsKeys.imageUrl(fileId ?? ''),
    queryFn: async () => unwrap(await fetchHospitalImageUrl(fileId ?? '')),
    enabled: fileId !== null,
    staleTime: IMAGE_URL_STALE_TIME_MS,
    refetchInterval: IMAGE_URL_STALE_TIME_MS,
    retry: false,
  });
}
