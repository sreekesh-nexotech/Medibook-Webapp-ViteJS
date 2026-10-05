import type { Result } from '@/core/error/failure';

import type { HospitalBanner } from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

export function fetchBanners(): Promise<Result<readonly HospitalBanner[]>> {
  return profileRepository.listBanners();
}
