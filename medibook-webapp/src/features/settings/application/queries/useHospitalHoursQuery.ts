import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchHospitalHours } from '@/features/settings/application/usecases/fetchHospitalHours';

/** Hospital working hours, one entry per configured weekday (0 = Monday). */
export function useHospitalHoursQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.hours(),
    queryFn: async () => unwrap(await fetchHospitalHours()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
