import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { addChecklistItems } from '@/features/ops-hospitals/application/usecases/addChecklistItems';

interface AddChecklistInput {
  readonly caseId: string;
  readonly codes: readonly string[];
}

/** Add catalogue documents to a case's checklist as pending. */
export function useAddChecklistItemsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, codes }: AddChecklistInput) =>
      unwrap(await addChecklistItems(caseId, codes)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
