import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchNumberingSeries } from '@/features/settings/application/usecases/fetchNumberingSeries';

/** The hospital's numbering series (MRN, booking ref, receipt). */
export function useNumberingQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.numbering(),
    queryFn: async () => unwrap(await fetchNumberingSeries()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
