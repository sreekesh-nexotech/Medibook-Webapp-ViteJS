import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PROFILE_STALE_TIME_MS,
  profileKeys,
} from '@/features/settings/application/queries/profile.keys';
import { fetchHolidays } from '@/features/settings/application/usecases/fetchHolidays';

/**
 * The holiday calendar (`GET /hospital/holidays`) — the closures slot
 * generation respects. Slots (H5) should read closures from here.
 */
export function useHolidaysQuery(enabled = true) {
  return useQuery({
    queryKey: profileKeys.holidays(),
    queryFn: async () => unwrap(await fetchHolidays()),
    staleTime: PROFILE_STALE_TIME_MS,
    enabled,
  });
}
