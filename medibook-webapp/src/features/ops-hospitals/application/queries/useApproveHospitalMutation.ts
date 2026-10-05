import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { approveHospital } from '@/features/ops-hospitals/application/usecases/approveHospital';

/** Approve a hospital's onboarding case (`POST /platform/hospitals/{id}/approve`). */
export function useApproveHospitalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hospitalId: string) => unwrap(await approveHospital(hospitalId)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
