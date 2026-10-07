import type { Result } from '@/core/error/failure';

import type {
  PatientCreateInput,
  PatientCreateOutcome,
} from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function createPatient(input: PatientCreateInput): Promise<Result<PatientCreateOutcome>> {
  return patientsRepository.createPatient(input);
}
