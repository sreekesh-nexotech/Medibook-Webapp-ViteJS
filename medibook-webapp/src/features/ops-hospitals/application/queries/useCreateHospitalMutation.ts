import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalCreateInput } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { onboardingKeys } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { createHospital } from '@/features/ops-hospitals/application/usecases/createHospital';

/** Provision a new hospital; it starts in onboarding with its first admin invited. */
export function useCreateHospitalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: HospitalCreateInput) => unwrap(await createHospital(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
}
