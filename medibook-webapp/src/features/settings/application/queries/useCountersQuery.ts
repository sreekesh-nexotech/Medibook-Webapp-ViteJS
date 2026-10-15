import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchCounters } from '@/features/settings/application/usecases/fetchCounters';

/** The hospital's front-desk counters. */
export function useCountersQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.counters(),
    queryFn: async () => unwrap(await fetchCounters()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
