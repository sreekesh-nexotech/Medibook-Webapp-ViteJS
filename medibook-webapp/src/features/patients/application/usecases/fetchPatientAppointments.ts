import type { Result } from '@/core/error/failure';

import type { PatientAppointmentHistory } from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function fetchPatientAppointments(
  id: string,
  limit: number,
): Promise<Result<PatientAppointmentHistory>> {
  return patientsRepository.listPatientAppointments(id, limit);
}
