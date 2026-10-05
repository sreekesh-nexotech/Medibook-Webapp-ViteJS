import type { Result } from '@/core/error/failure';

import type {
  PatientCreateOutcome,
  PatientDemographics,
} from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function createPatient(
  demographics: PatientDemographics,
): Promise<Result<PatientCreateOutcome>> {
  return patientsRepository.createPatient(demographics);
}
