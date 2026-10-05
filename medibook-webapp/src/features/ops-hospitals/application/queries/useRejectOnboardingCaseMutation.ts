import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { rejectOnboardingCase } from '@/features/ops-hospitals/application/usecases/rejectOnboardingCase';

interface RejectCaseInput {
  readonly caseId: string;
  readonly reason: string;
}

/** Close an application as rejected, with the reason the hospital is given. */
export function useRejectOnboardingCaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, reason }: RejectCaseInput) =>
      unwrap(await rejectOnboardingCase(caseId, reason)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
