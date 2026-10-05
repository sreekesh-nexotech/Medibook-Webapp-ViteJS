import type { Result } from '@/core/error/failure';

import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function fetchDoctorPhotoUrl(fileId: string): Promise<Result<string>> {
  return doctorsRepository.getPhotoUrl(fileId);
}
