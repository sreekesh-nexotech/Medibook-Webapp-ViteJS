import type { Result } from '@/core/error/failure';

import type { OnboardingPipeline } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function fetchOnboardingCases(): Promise<Result<OnboardingPipeline>> {
  return onboardingRepository.listCases();
}
