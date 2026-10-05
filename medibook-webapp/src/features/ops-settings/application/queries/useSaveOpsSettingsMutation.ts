import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import type { PlatformSettingsValues } from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { opsSettingsKeys } from '@/features/ops-settings/application/queries/opsSettings.keys';
import { saveOpsSettings } from '@/features/ops-settings/application/usecases/saveOpsSettings';

interface SaveOpsSettingsInput {
  readonly values: PlatformSettingsValues;
  readonly version: number;
}

/** Replace the platform settings; the saved record becomes the cached one. */
export function useSaveOpsSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, version }: SaveOpsSettingsInput) =>
      unwrap(await saveOpsSettings(values, version)),
    onSuccess: (settings) => {
      queryClient.setQueryData(opsSettingsKeys.settings(), settings);
    },
    onError: (failure) => {
      // A version conflict means someone else saved first — re-read the record.
      if (isFailure(failure) && failure.kind === 'conflict') {
        void queryClient.invalidateQueries({ queryKey: opsSettingsKeys.settings() });
      }
    },
  });
}
