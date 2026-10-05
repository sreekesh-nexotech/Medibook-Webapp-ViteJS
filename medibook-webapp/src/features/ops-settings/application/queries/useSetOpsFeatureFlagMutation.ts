import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { setOpsFeatureFlagEnabled } from '@/features/ops-settings/application/usecases/setOpsFeatureFlagEnabled';

interface SetOpsFeatureFlagInput {
  readonly key: string;
  readonly enabled: boolean;
}

/** Switch a feature flag on or off. */
export function useSetOpsFeatureFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: SetOpsFeatureFlagInput) =>
      unwrap(await setOpsFeatureFlagEnabled(key, enabled)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: opsSettingsKeys.featureFlags() }),
  });
}
