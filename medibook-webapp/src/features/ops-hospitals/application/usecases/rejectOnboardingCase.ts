import type { Result } from '@/core/error/failure';

import type { OnboardingCaseDetail } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function rejectOnboardingCase(
  caseId: string,
  reason: string,
): Promise<Result<OnboardingCaseDetail>> {
  return onboardingRepository.rejectCase(caseId, reason);
}
