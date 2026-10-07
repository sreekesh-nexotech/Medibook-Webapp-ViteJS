import type { Result } from '@/core/error/failure';

import { onboardingDocumentsRepository } from '@/features/ops-onboarding-documents/infrastructure/repositories/onboardingDocuments.repository.impl';

export function removeDocumentRequirement(id: string, version: number): Promise<Result<null>> {
  return onboardingDocumentsRepository.deleteRequirement(id, version);
}
