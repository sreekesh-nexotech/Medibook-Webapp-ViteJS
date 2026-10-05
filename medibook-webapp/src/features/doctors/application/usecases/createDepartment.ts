import type { Result } from '@/core/error/failure';

import type { Department, DepartmentInput } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsRepository } from '@/features/doctors/infrastructure/repositories/doctors.repository.impl';

export function createDepartment(input: DepartmentInput): Promise<Result<Department>> {
  return doctorsRepository.createDepartment(input);
}
