import type { Result } from '@/core/error/failure';

import type {
  ManualOnboardingStage,
  OnboardingCaseDetail,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function setOnboardingStage(
  caseId: string,
  stage: ManualOnboardingStage,
  version: number | null,
): Promise<Result<OnboardingCaseDetail>> {
  return onboardingRepository.setStage(caseId, stage, version);
}
