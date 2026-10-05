import type { Result } from '@/core/error/failure';

import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function deleteDepartment(id: string): Promise<Result<null>> {
  return doctorsRepository.deleteDepartment(id);
}
