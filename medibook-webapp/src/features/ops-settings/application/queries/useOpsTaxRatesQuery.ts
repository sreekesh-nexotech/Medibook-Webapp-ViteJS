import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  OPS_SETTINGS_STALE_TIME_MS,
  opsSettingsKeys,
} from '@/features/ops-settings/application/queries/opsSettings.keys';
import { fetchOpsTaxRates } from '@/features/ops-settings/application/usecases/fetchOpsTaxRates';

export function useOpsTaxRatesQuery() {
  return useQuery({
    queryKey: opsSettingsKeys.taxRates(),
    queryFn: async () => unwrap(await fetchOpsTaxRates()),
    staleTime: OPS_SETTINGS_STALE_TIME_MS,
  });
}
