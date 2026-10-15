import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PatientApproval,
  PatientApprovalListParams,
} from '@/features/patients/domain/entities/patients.entities';
import { patientsRepository } from '@/features/patients/infrastructure/repositories/patients.repository.impl';

export function fetchPatientApprovals(
  params: PatientApprovalListParams,
): Promise<Result<Page<PatientApproval>>> {
  return patientsRepository.listApprovals(params);
}
