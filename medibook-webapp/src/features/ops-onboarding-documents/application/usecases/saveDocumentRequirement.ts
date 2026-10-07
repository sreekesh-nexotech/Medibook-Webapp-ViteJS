import type { Result } from '@/core/error/failure';

import type {
  DocumentRequirement,
  DocumentRequirementDraft,
} from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import { onboardingDocumentsRepository } from '@/features/ops-onboarding-documents/infrastructure/repositories/onboardingDocuments.repository.impl';

/** Create the requirement (`id` null) or update it at `version`. */
export function saveDocumentRequirement(
  id: string | null,
  draft: DocumentRequirementDraft,
  version: number,
): Promise<Result<DocumentRequirement>> {
  return id === null
    ? onboardingDocumentsRepository.createRequirement(draft)
    : onboardingDocumentsRepository.updateRequirement(id, draft, version);
}
