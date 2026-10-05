import type { Result } from '@/core/error/failure';

import type {
  BannerInput,
  HospitalBanner,
} from '@/features/settings/domain/entities/profile.entities';
import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Publish a new banner at rotation position `sortOrder` (enabled). */
export function createBanner(
  input: BannerInput,
  sortOrder: number,
): Promise<Result<HospitalBanner>> {
  return profileRepository.createBanner(input, sortOrder);
}
