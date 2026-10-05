import type { Result } from '@/core/error/failure';

import type { HospitalImagePurpose } from '@/features/settings/domain/entities/settings.entities';
import { settingsRepository } from '@/features/settings/infrastructure/repositories/settings.repository.impl';

/** Resolves to the stored file id, ready to attach to the profile. */
export function uploadHospitalImage(
  file: File,
  purpose: HospitalImagePurpose,
): Promise<Result<string>> {
  return settingsRepository.uploadImage(file, purpose);
}
