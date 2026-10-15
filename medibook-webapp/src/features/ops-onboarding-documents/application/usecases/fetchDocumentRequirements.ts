import type { Result } from '@/core/error/failure';

import type { DocumentRequirement } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import { onboardingDocumentsRepository } from '@/features/ops-onboarding-documents/infrastructure/repositories/onboardingDocuments.repository.impl';

export function fetchDocumentRequirements(): Promise<Result<DocumentRequirement[]>> {
  return onboardingDocumentsRepository.listRequirements();
}
