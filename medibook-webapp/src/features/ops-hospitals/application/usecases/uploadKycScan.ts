import type { Result } from '@/core/error/failure';

import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

/** Upload a scan of a collected document (purpose `kyc`); resolves to its file id. */
export function uploadKycScan(file: File): Promise<Result<string>> {
  return onboardingRepository.uploadScan(file);
}
