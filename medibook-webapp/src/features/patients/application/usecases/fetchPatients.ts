import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PatientListParams,
  PatientRecord,
} from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function fetchPatients(params: PatientListParams): Promise<Result<Page<PatientRecord>>> {
  return patientsRepository.listPatients(params);
}
