import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { goLiveHospital } from '@/features/ops-hospitals/application/usecases/goLiveHospital';

/**
 * Take a hospital live. A `409 GO_LIVE_BLOCKED` failure carries the blockers;
 * the case is re-read either way so the screen shows what still blocks it.
 */
export function useGoLiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hospitalId: string) => unwrap(await goLiveHospital(hospitalId)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
