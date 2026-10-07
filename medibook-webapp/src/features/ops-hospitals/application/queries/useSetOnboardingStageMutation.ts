import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { ManualOnboardingStage } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { setOnboardingStage } from '@/features/ops-hospitals/application/usecases/setOnboardingStage';

interface SetStageInput {
  readonly caseId: string;
  readonly stage: ManualOnboardingStage;
  /** The case version (`If-Match`). */
  readonly version: number | null;
}

/** Move a case between the stages ops sets by hand — also re-opens a rejected case. */
export function useSetOnboardingStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, stage, version }: SetStageInput) =>
      unwrap(await setOnboardingStage(caseId, stage, version)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
