import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { updateOpsFeatureFlag } from '@/features/ops-settings/application/usecases/updateOpsFeatureFlag';
import type { FeatureFlagChanges } from '@/features/ops-settings/domain/entities/opsSettings.entity';

interface UpdateOpsFeatureFlagInput {
  readonly key: string;
  readonly changes: FeatureFlagChanges;
}

/** Switch a feature flag, or edit its description / public exposure. */
export function useUpdateOpsFeatureFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, changes }: UpdateOpsFeatureFlagInput) =>
      unwrap(await updateOpsFeatureFlag(key, changes)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: opsSettingsKeys.featureFlags() }),
  });
}
