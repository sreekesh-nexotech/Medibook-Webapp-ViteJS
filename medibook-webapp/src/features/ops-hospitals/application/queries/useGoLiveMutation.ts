import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { GoLiveFlags } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { goLiveHospital } from '@/features/ops-hospitals/application/usecases/goLiveHospital';

interface GoLiveInput {
  readonly hospitalId: string;
  /** `null`: go live without touching the patient-app switches (soft launch). */
  readonly flags: GoLiveFlags | null;
}

/**
 * Take a hospital live (and open it to patients in the same call when asked).
 * A `409 GO_LIVE_BLOCKED` failure carries the blockers; the case is re-read
 * either way so the screen shows what still blocks it.
 */
export function useGoLiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hospitalId, flags }: GoLiveInput) =>
      unwrap(await goLiveHospital(hospitalId, flags)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
