import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { rejectOnboardingCase } from '@/features/ops-hospitals/application/usecases/rejectOnboardingCase';

interface RejectCaseInput {
  readonly caseId: string;
  readonly reason: string;
  /** The case version (`If-Match`). */
  readonly version: number | null;
}

/** Close an application as rejected; the hospital is suspended (decision 9). */
export function useRejectOnboardingCaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, reason, version }: RejectCaseInput) =>
      unwrap(await rejectOnboardingCase(caseId, reason, version)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
