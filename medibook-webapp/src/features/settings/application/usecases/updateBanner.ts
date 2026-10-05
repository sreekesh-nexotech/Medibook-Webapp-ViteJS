import type { Result } from '@/core/error/failure';

import type {
  BannerChanges,
  HospitalBanner,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

export function updateBanner(
  id: string,
  changes: BannerChanges,
  version: number,
): Promise<Result<HospitalBanner>> {
  return profileRepository.updateBanner(id, changes, version);
}
