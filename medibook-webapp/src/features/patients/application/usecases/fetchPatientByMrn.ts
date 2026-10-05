import type { Result } from '@/core/error/failure';

import type { PatientRecord } from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function fetchPatientByMrn(mrn: string): Promise<Result<PatientRecord>> {
  return patientsRepository.getPatientByMrn(mrn);
}
