import type { Result } from '@/core/error/failure';

import type {
  OnboardingCaseChanges,
  OnboardingCaseDetail,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function updateOnboardingCase(
  caseId: string,
  changes: OnboardingCaseChanges,
  version: number | null,
): Promise<Result<OnboardingCaseDetail>> {
  return onboardingRepository.updateCase(caseId, changes, version);
}
