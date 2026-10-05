import type { Result } from '@/core/error/failure';

import type { DocumentRequirement } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function fetchDocumentRequirements(): Promise<Result<readonly DocumentRequirement[]>> {
  return onboardingRepository.listDocumentRequirements();
}
