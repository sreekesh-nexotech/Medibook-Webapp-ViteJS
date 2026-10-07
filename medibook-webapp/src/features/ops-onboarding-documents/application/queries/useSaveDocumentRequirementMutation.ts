import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { onboardingDocumentsKeys } from '@/features/ops-onboarding-documents/application/queries/onboardingDocuments.keys';
import { saveDocumentRequirement } from '@/features/ops-onboarding-documents/application/usecases/saveDocumentRequirement';
import type { DocumentRequirementDraft } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';

interface SaveInput {
  /** The requirement being edited, or `null` to create one. */
  readonly id: string | null;
  readonly draft: DocumentRequirementDraft;
  /** The version the editor opened on (`If-Match`); ignored on create. */
  readonly version: number;
}

/** Create or edit a requirement; the list refetches either way, so a conflict shows the latest. */
export function useSaveDocumentRequirementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, draft, version }: SaveInput) =>
      unwrap(await saveDocumentRequirement(id, draft, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingDocumentsKeys.list() });
    },
  });
}
