import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  OPS_SETTINGS_STALE_TIME_MS,
  opsSettingsKeys,
} from '@/features/ops-settings/application/queries/opsSettings.keys';
import { fetchOpsSettings } from '@/features/ops-settings/application/usecases/fetchOpsSettings';

/**
 * The platform settings record. No refetch on window focus: the form is seeded
 * from this record, so it should only change on a save or an explicit reload.
 */
export function useOpsSettingsQuery() {
  return useQuery({
    queryKey: opsSettingsKeys.settings(),
    queryFn: async () => unwrap(await fetchOpsSettings()),
    staleTime: OPS_SETTINGS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
