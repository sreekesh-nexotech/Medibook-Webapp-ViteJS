import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientApprovalListParams } from '@/features/patients/domain/entities/patients.entities';
import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatientApprovals } from '@/features/patients/application/usecases/fetchPatientApprovals';

/**
 * One page of the patient approvals queue (D-29). Idle when `enabled` is
 * false — roles without `patient_approvals.view` never ask.
 */
export function usePatientApprovalsQuery(params: PatientApprovalListParams, enabled: boolean) {
  return useQuery({
    queryKey: patientsKeys.approvalPage(params),
    queryFn: async () => unwrap(await fetchPatientApprovals(params)),
    placeholderData: keepPreviousData,
    staleTime: PATIENTS_STALE_TIME_MS,
    enabled,
  });
}
