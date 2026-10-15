import type { Result } from '@/core/error/failure';

import type { PatientDeleteOutcome } from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function deletePatient(id: string, version: number): Promise<Result<PatientDeleteOutcome>> {
  return patientsRepository.deletePatient(id, version);
}
