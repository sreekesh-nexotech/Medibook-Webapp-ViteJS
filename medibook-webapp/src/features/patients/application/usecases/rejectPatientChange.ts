import type { Result } from '@/core/error/failure';

import type { PatientChangeDecision } from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function rejectPatientChange(
  requestId: string,
  note: string,
): Promise<Result<PatientChangeDecision>> {
  return patientsRepository.rejectPatientChange(requestId, note);
}
