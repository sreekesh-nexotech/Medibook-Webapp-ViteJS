import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { onboardingDocumentsKeys } from '@/features/ops-onboarding-documents/application/queries/onboardingDocuments.keys';
import { removeDocumentRequirement } from '@/features/ops-onboarding-documents/application/usecases/removeDocumentRequirement';

interface DeleteInput {
  readonly id: string;
  readonly version: number;
}

/** Remove a requirement (soft delete); the list refetches. */
export function useDeleteDocumentRequirementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeleteInput) =>
      unwrap(await removeDocumentRequirement(id, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingDocumentsKeys.list() });
    },
  });
}
