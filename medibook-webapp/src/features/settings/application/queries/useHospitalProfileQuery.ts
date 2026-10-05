import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchHospitalProfile } from '@/features/settings/application/usecases/fetchHospitalProfile';

/** The hospital's own profile (`GET /hospital/profile`). */
export function useHospitalProfileQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async () => unwrap(await fetchHospitalProfile()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
