import type { Result } from '@/core/error/failure';

import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function fetchCompletedVisitCount(id: string): Promise<Result<number>> {
  return patientsRepository.countCompletedVisits(id);
}
