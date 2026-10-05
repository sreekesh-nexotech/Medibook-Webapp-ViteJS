import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { ManualOnboardingStage } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { setOnboardingStage } from '@/features/ops-hospitals/application/usecases/setOnboardingStage';

interface SetStageInput {
  readonly caseId: string;
  readonly stage: ManualOnboardingStage;
}

/** Move a case between the stages ops sets by hand. */
export function useSetOnboardingStageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, stage }: SetStageInput) =>
      unwrap(await setOnboardingStage(caseId, stage)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
