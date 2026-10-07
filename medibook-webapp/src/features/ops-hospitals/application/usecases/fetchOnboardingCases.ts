import type { Result } from '@/core/error/failure';

import type {
  OnboardingListQuery,
  OnboardingPipeline,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function fetchOnboardingCases(
  query: OnboardingListQuery,
): Promise<Result<OnboardingPipeline>> {
  return onboardingRepository.listCases(query);
}
