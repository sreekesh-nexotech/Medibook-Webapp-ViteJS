import type { Result } from '@/core/error/failure';

import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function goLiveHospital(hospitalId: string): Promise<Result<null>> {
  return onboardingRepository.goLive(hospitalId);
}
