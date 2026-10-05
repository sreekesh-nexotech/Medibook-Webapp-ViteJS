import type { Result } from '@/core/error/failure';

import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

/** Upload a banner creative; resolves to the stored file id. */
export function uploadBannerImage(file: File): Promise<Result<string>> {
  return profileRepository.uploadBannerImage(file);
}
