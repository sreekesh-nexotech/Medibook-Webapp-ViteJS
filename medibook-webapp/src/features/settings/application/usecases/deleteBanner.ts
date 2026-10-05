import type { Result } from '@/core/error/failure';

import { profileRepository } from '@/features/settings/infrastructure/repositories/profile.repository.impl';

export function deleteBanner(id: string, version: number): Promise<Result<null>> {
  return profileRepository.deleteBanner(id, version);
}
