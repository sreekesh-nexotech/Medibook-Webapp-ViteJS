import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalProfileChanges } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateHospitalProfile } from '@/features/settings/application/usecases/updateHospitalProfile';

interface UpdateProfileInput {
  readonly changes: HospitalProfileChanges;
  readonly version: number;
}

/** Patch the hospital profile (`If-Match` on the version that was edited). */
export function useUpdateHospitalProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, version }: UpdateProfileInput) =>
      unwrap(await updateHospitalProfile(changes, version)),
    onSuccess: (profile) => {
      queryClient.setQueryData(settingsKeys.profile(), profile);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.profile() }),
  });
}
