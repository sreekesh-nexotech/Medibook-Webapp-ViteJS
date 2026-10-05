import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PROFILE_STALE_TIME_MS,
  profileKeys,
} from '@/features/settings/application/queries/profile.keys';
import { fetchBanners } from '@/features/settings/application/usecases/fetchBanners';

/** The hospital's own patient-app banners, in rotation order. */
export function useBannersQuery(enabled = true) {
  return useQuery({
    queryKey: profileKeys.banners(),
    queryFn: async () => unwrap(await fetchBanners()),
    select: (banners) => [...banners].sort((a, b) => a.sortOrder - b.sortOrder),
    staleTime: PROFILE_STALE_TIME_MS,
    enabled,
  });
}
