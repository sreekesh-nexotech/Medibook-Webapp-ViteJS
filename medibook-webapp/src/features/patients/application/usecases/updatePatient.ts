import type { Result } from '@/core/error/failure';

import type {
  PatientDemographics,
  PatientEditOutcome,
} from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function updatePatient(
  id: string,
  changes: Partial<PatientDemographics>,
  version: number,
): Promise<Result<PatientEditOutcome>> {
  return patientsRepository.updatePatient(id, changes, version);
}
