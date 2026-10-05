import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  OPS_SETTINGS_STALE_TIME_MS,
  opsSettingsKeys,
} from '@/features/ops-settings/application/queries/opsSettings.keys';
import { fetchOpsFeatureFlags } from '@/features/ops-settings/application/usecases/fetchOpsFeatureFlags';

export function useOpsFeatureFlagsQuery() {
  return useQuery({
    queryKey: opsSettingsKeys.featureFlags(),
    queryFn: async () => unwrap(await fetchOpsFeatureFlags()),
    staleTime: OPS_SETTINGS_STALE_TIME_MS,
  });
}
