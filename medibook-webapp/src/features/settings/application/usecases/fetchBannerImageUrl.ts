import type { Result } from '@/core/error/failure';

import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

export function fetchBannerImageUrl(fileId: string): Promise<Result<string>> {
  return profileRepository.getBannerImageUrl(fileId);
}
