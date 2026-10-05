import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalRuleChanges } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateHospitalRuleSettings } from '@/features/settings/application/usecases/updateHospitalRuleSettings';

interface UpdateRulesInput {
  readonly changes: HospitalRuleChanges;
  readonly version: number;
}

/** Update the hospital rulebook (`If-Match` on the version that was edited). */
export function useUpdateHospitalRuleSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, version }: UpdateRulesInput) =>
      unwrap(await updateHospitalRuleSettings(changes, version)),
    onSuccess: (rules) => {
      queryClient.setQueryData(settingsKeys.rules(), rules);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.rules() }),
  });
}
