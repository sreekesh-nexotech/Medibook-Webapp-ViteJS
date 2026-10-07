import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { OnboardingCaseChanges } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { updateOnboardingCase } from '@/features/ops-hospitals/application/usecases/updateOnboardingCase';

interface UpdateCaseInput {
  readonly caseId: string;
  readonly changes: OnboardingCaseChanges;
  readonly version: number | null;
}

/** Save a case's notes or assignee (`onboarding.edit`, If-Match). */
export function useUpdateOnboardingCaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, changes, version }: UpdateCaseInput) =>
      unwrap(await updateOnboardingCase(caseId, changes, version)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
